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
