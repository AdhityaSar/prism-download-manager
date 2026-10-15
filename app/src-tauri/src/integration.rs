//! Browser integration: native messaging host registration and status.

use prism_native_host::registration::{self, Browser, Locations, RegisterOptions};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// The host executable shipped next to the app binary.
pub fn bundled_host_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let name = if cfg!(windows) {
        "prism-native-host.exe"
    } else {
        "prism-native-host"
    };
    exe.parent()
        .map(|d| d.join(name))
        .unwrap_or_else(|| PathBuf::from(name))
}

/// Host path that browsers should launch. Inside an AppImage the mount point changes on
/// every run, so the host is copied to a stable location in the data dir and the
/// AppImage path is recorded in `<data dir>/app-path` for the host to start the app.
pub fn host_path() -> PathBuf {
    let bundled = bundled_host_path();
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        let data = prism_core::paths::data_dir();
        let stable = data.join("bin").join("prism-native-host");
        let copy = || -> std::io::Result<()> {
            std::fs::create_dir_all(data.join("bin"))?;
            let needs_copy = std::fs::metadata(&stable).map(|m| m.len()).ok()
                != std::fs::metadata(&bundled).map(|m| m.len()).ok();
            if needs_copy {
                let tmp = stable.with_extension("tmp");
                std::fs::copy(&bundled, &tmp)?;
                std::fs::rename(&tmp, &stable)?;
            }
            std::fs::write(data.join("app-path"), appimage.to_string_lossy().as_bytes())
        };
        match copy() {
            Ok(()) => return stable,
            Err(e) => tracing::warn!("could not install stable native host copy: {e}"),
        }
    }
    bundled
}

/// Register the host for every supported browser (idempotent).
pub fn register() -> Result<serde_json::Value, String> {
    let host = host_path();
    if !host.exists() {
        return Err(format!("Native host not found at {}", host.display()));
    }
    registration::register(&RegisterOptions::new(&host)).map_err(|e| e.to_string())?;
    Ok(status())
}

pub fn status() -> serde_json::Value {
    let host = host_path();
    let browsers = registration::status(&Browser::ALL, &host, &Locations::default());
    serde_json::json!({
        "hostPath": host,
        "hostExists": host.exists(),
        "browsers": browsers,
        "extensionId": prism_native_host::CHROME_EXTENSION_ID,
        "firefoxExtensionId": prism_native_host::FIREFOX_EXTENSION_ID,
    })
}

/// Folder with the unpacked extension builds (for "Load unpacked" instructions).
pub fn extension_dir(app: &AppHandle) -> Option<PathBuf> {
    let res = app.path().resource_dir().ok()?.join("extension");
    if res.exists() {
        return Some(res);
    }
    // Development checkout.
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../extension/build");
    dev.exists().then(|| dev.canonicalize().unwrap_or(dev))
}

/// The folder a user picks in the browser's "Load unpacked" dialog (`.../extension/chromium`,
/// or the Firefox build), as a plain path that can be pasted into a file dialog.
pub fn extension_folder(app: &AppHandle, firefox: bool) -> Option<PathBuf> {
    let sub = if firefox { "firefox" } else { "chromium" };
    let dir = extension_dir(app)?.join(sub);
    // macOS: a folder inside Prism.app can't be picked comfortably in the browser's file
    // dialog, so keep a copy in Application Support (refreshed when the app updates it).
    #[cfg(target_os = "macos")]
    let dir = {
        let copy = prism_core::paths::data_dir().join("extension").join(sub);
        match sync_dir(&dir, &copy) {
            Ok(()) => copy,
            Err(e) => {
                tracing::warn!("could not copy the extension to {}: {e}", copy.display());
                dir
            }
        }
    };
    let s = dir.to_string_lossy();
    // `canonicalize` on Windows yields `\?\C:\...`, which file dialogs don't accept.
    Some(PathBuf::from(s.strip_prefix(r"\?\").unwrap_or(&s)))
}

/// Starts (or focuses) the browser with a new window. Browsers refuse to open their internal
/// pages (`chrome://extensions`) from the command line, so the UI copies that address for the
/// user to paste.
pub fn open_browser(browser: &str) -> Result<(), String> {
    launch(browser).map_err(|e| format!("Could not start the browser: {e}"))
}

#[cfg(windows)]
fn launch(browser: &str) -> std::io::Result<()> {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    let exe = match browser {
        "edge" => "msedge.exe",
        "brave" => "brave.exe",
        "vivaldi" => "vivaldi.exe",
        "opera" => "opera.exe",
        "firefox" => "firefox.exe",
        _ => "chrome.exe",
    };
    // Browsers register their executable under "App Paths" (what the Run dialog uses).
    let key = format!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{exe}");
    let path = [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]
        .into_iter()
        .find_map(|root| {
            let v: String = RegKey::predef(root)
                .open_subkey(&key)
                .ok()?
                .get_value("")
                .ok()?;
            let p = PathBuf::from(v.trim_matches('"'));
            p.exists().then_some(p)
        })
        .ok_or_else(|| std::io::Error::other(format!("{exe} is not installed")))?;
    std::process::Command::new(path).spawn().map(|_| ())
}

#[cfg(target_os = "macos")]
fn launch(browser: &str) -> std::io::Result<()> {
    let app = match browser {
        "edge" => "Microsoft Edge",
        "brave" => "Brave Browser",
        "vivaldi" => "Vivaldi",
        "opera" => "Opera",
        "chromium" => "Chromium",
        "firefox" => "Firefox",
        _ => "Google Chrome",
    };
    let status = std::process::Command::new("open")
        .args(["-a", app])
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!("{app} not found")))
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch(browser: &str) -> std::io::Result<()> {
    let candidates: &[&str] = match browser {
        "edge" => &["microsoft-edge", "microsoft-edge-stable"],
        "brave" => &["brave-browser", "brave"],
        "vivaldi" => &["vivaldi", "vivaldi-stable"],
        "opera" => &["opera"],
        "chromium" => &["chromium", "chromium-browser"],
        "firefox" => &["firefox"],
        _ => &["google-chrome", "google-chrome-stable"],
    };
    let mut last = std::io::Error::from(std::io::ErrorKind::NotFound);
    for exe in candidates {
        match std::process::Command::new(exe)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            Ok(mut child) => {
                // Reap it (a browser that hands the URL to a running instance exits at once).
                std::thread::spawn(move || child.wait());
                return Ok(());
            }
            Err(e) => last = e,
        }
    }
    Err(last)
}

/// Mirrors `src` into `dst` when the extension build differs (new app version).
#[cfg(target_os = "macos")]
fn sync_dir(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    let stamp = |d: &std::path::Path| {
        ["manifest.json", "background.js"].map(|f| std::fs::read(d.join(f)).ok())
    };
    let current = stamp(src);
    if current[0].is_some() && current == stamp(dst) {
        return Ok(());
    }
    let tmp = dst.with_extension("tmp");
    let _ = std::fs::remove_dir_all(&tmp);
    copy_dir(src, &tmp)?;
    let _ = std::fs::remove_dir_all(dst);
    std::fs::rename(&tmp, dst)
}

#[cfg(target_os = "macos")]
fn copy_dir(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else {
            std::fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}
