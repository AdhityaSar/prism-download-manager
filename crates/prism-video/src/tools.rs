//! Locating, installing (SHA-256 verified) and updating yt-dlp, ffmpeg/ffprobe and deno.
//!
//! Resolution order per tool: custom path → managed copy in `tools_dir` → system `PATH` → missing.
//!
//! Sources:
//! * yt-dlp — GitHub releases of `yt-dlp/yt-dlp` (stable) or `yt-dlp/yt-dlp-nightly-builds`
//!   (nightly), verified against that same release's `SHA2-256SUMS`.
//! * deno — `denoland/deno` latest release `deno-<triple>.zip`, verified with `<asset>.sha256sum`.
//! * ffmpeg + ffprobe — Windows/Linux: BtbN `FFmpeg-Builds` `latest` (`checksums.sha256`);
//!   macOS: static builds from `ffmpeg.martin-riedl.de` (per-file `.sha256`).

use std::collections::HashMap;
use std::fmt;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

use crate::error::{Result, VideoError};
use crate::model::{UpdateChannel, VideoOptions};
use crate::process;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Tool {
    YtDlp,
    Ffmpeg,
    Ffprobe,
    Deno,
}

impl Tool {
    pub const ALL: [Tool; 4] = [Tool::YtDlp, Tool::Ffmpeg, Tool::Ffprobe, Tool::Deno];

    pub fn name(self) -> &'static str {
        match self {
            Tool::YtDlp => "yt-dlp",
            Tool::Ffmpeg => "ffmpeg",
            Tool::Ffprobe => "ffprobe",
            Tool::Deno => "deno",
        }
    }

    /// File name of the executable on this OS (`yt-dlp.exe`, `ffmpeg` ...).
    pub fn exe_name(self) -> String {
        format!("{}{}", self.name(), std::env::consts::EXE_SUFFIX)
    }
}

impl fmt::Display for Tool {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.name())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolSource {
    /// Downloaded and verified by Prism into the tools directory.
    Managed,
    /// Found on `PATH`.
    System,
    /// Path configured by the user.
    Custom,
    Missing,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInfo {
    pub tool: Tool,
    pub path: Option<PathBuf>,
    pub version: Option<String>,
    pub source: ToolSource,
    /// Hint for the UI (why missing, how to install, custom path invalid ...).
    pub message: Option<String>,
}

impl ToolInfo {
    pub fn is_available(&self) -> bool {
        self.source != ToolSource::Missing && self.path.is_some()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub yt_dlp: ToolInfo,
    pub ffmpeg: ToolInfo,
    pub ffprobe: ToolInfo,
    pub deno: ToolInfo,
}

impl ToolStatus {
    pub fn get(&self, tool: Tool) -> &ToolInfo {
        match tool {
            Tool::YtDlp => &self.yt_dlp,
            Tool::Ffmpeg => &self.ffmpeg,
            Tool::Ffprobe => &self.ffprobe,
            Tool::Deno => &self.deno,
        }
    }

    /// yt-dlp and ffmpeg are present (deno is optional but recommended for YouTube).
    pub fn ready(&self) -> bool {
        self.yt_dlp.is_available() && self.ffmpeg.is_available()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolPhase {
    Resolving,
    Downloading,
    Verifying,
    Extracting,
    Installed,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolProgress {
    pub tool: Tool,
    pub phase: ToolPhase,
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateOutcome {
    UpToDate {
        version: Option<String>,
    },
    Updated {
        from: Option<String>,
        to: Option<String>,
    },
    /// yt-dlp comes from PATH or a custom location; Prism does not touch it.
    #[serde(rename_all = "camelCase")]
    NotManaged {
        source: ToolSource,
        path: Option<PathBuf>,
    },
}

pub(crate) type ProgressFn<'a> = &'a (dyn Fn(ToolProgress) + Send + Sync);

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

pub(crate) fn managed_path(tools_dir: &Path, tool: Tool) -> PathBuf {
    tools_dir.join(tool.exe_name())
}

/// Search `PATH` for an executable.
pub fn which(exe_name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(exe_name))
        .find(|p| p.is_file())
}

fn custom_path(tool: Tool, opts: &VideoOptions) -> Option<PathBuf> {
    let p = match tool {
        Tool::YtDlp => opts.ytdlp_path.clone(),
        Tool::Ffmpeg => opts.ffmpeg_path.clone(),
        Tool::Ffprobe => opts.ffmpeg_path.as_ref().map(|p| {
            if p.is_dir() {
                p.join(Tool::Ffprobe.exe_name())
            } else {
                p.with_file_name(Tool::Ffprobe.exe_name())
            }
        }),
        Tool::Deno => opts.deno_path.clone(),
    }?;
    if p.as_os_str().is_empty() {
        return None;
    }
    Some(if p.is_dir() {
        p.join(tool.exe_name())
    } else {
        p
    })
}

/// Resolve a tool without running it.
pub(crate) fn resolve(
    tool: Tool,
    tools_dir: &Path,
    opts: &VideoOptions,
) -> (Option<PathBuf>, ToolSource, Option<String>) {
    let mut message = None;
    if let Some(p) = custom_path(tool, opts) {
        if p.is_file() {
            return (Some(p), ToolSource::Custom, None);
        }
        message = Some(format!(
            "custom path {} not found; using fallback",
            p.display()
        ));
    }
    let managed = managed_path(tools_dir, tool);
    if managed.is_file() {
        return (Some(managed), ToolSource::Managed, message);
    }
    if let Some(p) = which(&tool.exe_name()) {
        return (Some(p), ToolSource::System, message);
    }
    let hint = match tool {
        Tool::Deno => "not installed — needed by yt-dlp for full YouTube support",
        Tool::Ffmpeg | Tool::Ffprobe if cfg!(target_os = "macos") => {
            "not installed — click Install, or run `brew install ffmpeg`"
        }
        _ => "not installed",
    };
    (
        None,
        ToolSource::Missing,
        Some(
            message
                .map(|m| format!("{m}; {hint}"))
                .unwrap_or_else(|| hint.to_string()),
        ),
    )
}

pub fn parse_version(tool: Tool, stdout: &str) -> Option<String> {
    let first = stdout.lines().map(str::trim).find(|l| !l.is_empty())?;
    match tool {
        Tool::YtDlp => Some(first.to_string()),
        // "ffmpeg version 9.0.1-full_build-www.gyan.dev Copyright (c) ..."
        Tool::Ffmpeg | Tool::Ffprobe => {
            let mut it = first.split_whitespace();
            while let Some(w) = it.next() {
                if w == "version" {
                    return it.next().map(str::to_string);
                }
            }
            Some(first.to_string())
        }
        // "deno 2.9.7 (stable, release, x86_64-pc-windows-msvc)"
        Tool::Deno => first.split_whitespace().nth(1).map(str::to_string),
    }
}

/// Cache of `(path) -> (mtime, len, version)` so repeated status queries don't spawn processes.
type VersionKey = (Option<SystemTime>, u64, String);

#[derive(Default)]
pub(crate) struct VersionCache(std::sync::Mutex<HashMap<PathBuf, VersionKey>>);

impl VersionCache {
    pub async fn version(&self, tool: Tool, path: &Path) -> Option<String> {
        let meta = std::fs::metadata(path).ok()?;
        let key = (meta.modified().ok(), meta.len());
        if let Some((m, l, v)) = self.0.lock().ok()?.get(path)
            && (*m, *l) == key
        {
            return Some(v.clone());
        }
        let flag = match tool {
            Tool::Ffmpeg | Tool::Ffprobe => "-version",
            _ => "--version",
        };
        let out = process::run_capture(tool, path, [flag], Duration::from_secs(60))
            .await
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let v = parse_version(tool, &String::from_utf8_lossy(&out.stdout))?;
        if let Ok(mut map) = self.0.lock() {
            map.insert(path.to_path_buf(), (key.0, key.1, v.clone()));
        }
        Some(v)
    }
}

pub(crate) async fn tool_info(
    tool: Tool,
    tools_dir: &Path,
    opts: &VideoOptions,
    cache: &VersionCache,
) -> ToolInfo {
    let (path, source, message) = resolve(tool, tools_dir, opts);
    let version = match &path {
        Some(p) => cache.version(tool, p).await,
        None => None,
    };
    ToolInfo {
        tool,
        path,
        version,
        source,
        message,
    }
}

// ---------------------------------------------------------------------------
// Checksums
// ---------------------------------------------------------------------------

fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Parse a GNU-style checksum list (`<hex>  <name>` or `<hex> *<name>`) into `name -> lowercase hex`.
pub fn parse_checksums(text: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in text.lines() {
        let line = line.trim();
        let Some((hash, rest)) = line.split_once(char::is_whitespace) else {
            continue;
        };
        if !is_sha256_hex(hash) {
            continue;
        }
        let name = rest.trim().trim_start_matches('*').trim();
        // Accept paths ("./bin/x") by keeping the last component as well.
        let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
        map.insert(name.to_string(), hash.to_ascii_lowercase());
        map.entry(base.to_string())
            .or_insert_with(|| hash.to_ascii_lowercase());
    }
    map
}

/// Extract the hash from a single-file checksum (`<hex>  name`, a bare hex string, or
/// PowerShell `Get-FileHash` list output with `Hash : <HEX>` as deno publishes for Windows).
pub fn parse_single_checksum(text: &str) -> Option<String> {
    text.split(|c: char| c.is_whitespace() || c == ':' || c == '*')
        .find(|t| is_sha256_hex(t))
        .map(|t| t.to_ascii_lowercase())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(s, "{b:02x}");
    }
    s
}

/// SHA-256 of a file (blocking; call from `spawn_blocking`).
pub fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(hex(&h.finalize()))
}

// ---------------------------------------------------------------------------
// Release assets per platform
// ---------------------------------------------------------------------------

pub(crate) fn ytdlp_repo(channel: UpdateChannel) -> &'static str {
    match channel {
        UpdateChannel::Stable => "yt-dlp/yt-dlp",
        UpdateChannel::Nightly => "yt-dlp/yt-dlp-nightly-builds",
    }
}

pub fn ytdlp_asset() -> Option<&'static str> {
    use std::env::consts::{ARCH, OS};
    Some(match (OS, ARCH) {
        ("windows", "x86_64") => "yt-dlp.exe",
        ("windows", "aarch64") => "yt-dlp_arm64.exe",
        ("windows", "x86") => "yt-dlp_x86.exe",
        ("linux", "x86_64") => "yt-dlp_linux",
        ("linux", "aarch64") => "yt-dlp_linux_aarch64",
        ("macos", _) => "yt-dlp_macos",
        _ => return None,
    })
}

pub fn deno_asset() -> Option<String> {
    use std::env::consts::{ARCH, OS};
    let triple = match (OS, ARCH) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        _ => return None,
    };
    Some(format!("deno-{triple}.zip"))
}

/// BtbN FFmpeg-Builds asset for this platform (Windows/Linux only).
pub fn btbn_asset() -> Option<&'static str> {
    use std::env::consts::{ARCH, OS};
    Some(match (OS, ARCH) {
        ("windows", "x86_64") => "ffmpeg-master-latest-win64-gpl.zip",
        ("windows", "aarch64") => "ffmpeg-master-latest-winarm64-gpl.zip",
        ("linux", "x86_64") => "ffmpeg-master-latest-linux64-gpl.tar.xz",
        ("linux", "aarch64") => "ffmpeg-master-latest-linuxarm64-gpl.tar.xz",
        _ => return None,
    })
}

const GITHUB: &str = "https://github.com";
const MARTIN_RIEDL: &str = "https://ffmpeg.martin-riedl.de";

fn release_url(repo: &str, tag: &str, asset: &str) -> String {
    format!("{GITHUB}/{repo}/releases/download/{tag}/{asset}")
}

/// Extract the tag from a `.../releases/tag/<tag>` URL.
pub fn tag_from_location(location: &str) -> Option<String> {
    let idx = location.find("/releases/tag/")?;
    let tag = &location[idx + "/releases/tag/".len()..];
    let tag = tag.split(['?', '#']).next()?.trim_end_matches('/');
    (!tag.is_empty()).then(|| tag.to_string())
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

pub(crate) fn http_client(opts: &VideoOptions, follow_redirects: bool) -> Result<reqwest::Client> {
    let mut b = reqwest::Client::builder()
        .user_agent(concat!(
            "Prism/",
            env!("CARGO_PKG_VERSION"),
            " (prism-video)"
        ))
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(Duration::from_secs(60));
    if !follow_redirects {
        b = b.redirect(reqwest::redirect::Policy::none());
    }
    if let Some(p) = &opts.proxy {
        b = b.proxy(reqwest::Proxy::all(p.as_str())?);
    }
    Ok(b.build()?)
}

pub(crate) struct Http {
    pub client: reqwest::Client,
    pub no_redirect: reqwest::Client,
}

impl Http {
    pub fn new(opts: &VideoOptions) -> Result<Http> {
        Ok(Http {
            client: http_client(opts, true)?,
            no_redirect: http_client(opts, false)?,
        })
    }

    /// Resolve `releases/latest` to a concrete tag so the checksum file and the
    /// asset are guaranteed to come from the same release.
    pub async fn latest_tag(&self, repo: &str) -> Result<String> {
        let url = format!("{GITHUB}/{repo}/releases/latest");
        let resp = self.no_redirect.get(&url).send().await?;
        let loc = resp
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
            .ok_or_else(|| {
                VideoError::Other(format!(
                    "{url}: no redirect to a release tag (status {})",
                    resp.status()
                ))
            })?;
        tag_from_location(&loc)
            .ok_or_else(|| VideoError::Other(format!("cannot parse release tag from {loc}")))
    }

    /// Follow one redirect manually and return the absolute target URL.
    pub async fn redirect_target(&self, url: &str) -> Result<String> {
        let resp = self.no_redirect.get(url).send().await?;
        let status = resp.status();
        let loc = resp
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| VideoError::HttpStatus {
                status: status.as_u16(),
                url: url.to_string(),
            })?;
        let base = url::Url::parse(url).map_err(|e| VideoError::Other(e.to_string()))?;
        Ok(base
            .join(loc)
            .map_err(|e| VideoError::Other(e.to_string()))?
            .to_string())
    }

    pub async fn text(&self, url: &str) -> Result<String> {
        let resp = self.client.get(url).send().await?;
        if !resp.status().is_success() {
            return Err(VideoError::HttpStatus {
                status: resp.status().as_u16(),
                url: url.to_string(),
            });
        }
        Ok(resp.text().await?)
    }

    /// Stream `url` into `dest`, hashing on the fly; verify against `expected_sha256`.
    pub async fn download_verified(
        &self,
        tool: Tool,
        url: &str,
        dest: &Path,
        expected_sha256: &str,
        progress: ProgressFn<'_>,
    ) -> Result<()> {
        let resp = self.client.get(url).send().await?;
        if !resp.status().is_success() {
            return Err(VideoError::HttpStatus {
                status: resp.status().as_u16(),
                url: url.to_string(),
            });
        }
        let total = resp.content_length();
        let mut file = tokio::fs::File::create(dest).await?;
        let mut hasher = Sha256::new();
        let mut downloaded = 0u64;
        let mut last_report = 0u64;
        progress(ToolProgress {
            tool,
            phase: ToolPhase::Downloading,
            downloaded: 0,
            total,
        });
        let mut stream = resp.bytes_stream();
        let res: Result<()> = async {
            while let Some(chunk) = stream.next().await {
                let chunk = chunk?;
                file.write_all(&chunk).await?;
                hasher.update(&chunk);
                downloaded += chunk.len() as u64;
                if downloaded - last_report >= 256 * 1024 {
                    last_report = downloaded;
                    progress(ToolProgress {
                        tool,
                        phase: ToolPhase::Downloading,
                        downloaded,
                        total,
                    });
                }
            }
            file.flush().await?;
            file.sync_all().await?;
            Ok(())
        }
        .await;
        drop(file);
        if let Err(e) = res {
            let _ = tokio::fs::remove_file(dest).await;
            return Err(e);
        }
        progress(ToolProgress {
            tool,
            phase: ToolPhase::Verifying,
            downloaded,
            total,
        });
        let actual = hex(&hasher.finalize());
        if !actual.eq_ignore_ascii_case(expected_sha256) {
            let _ = tokio::fs::remove_file(dest).await;
            return Err(VideoError::ChecksumMismatch {
                file: url.rsplit('/').next().unwrap_or(url).to_string(),
                expected: expected_sha256.to_string(),
                actual,
            });
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Unique temp path inside `dir` (same volume as the final file → atomic rename).
pub(crate) fn temp_path(dir: &Path, stem: &str) -> PathBuf {
    let n = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    dir.join(format!(".{stem}.{}-{nanos}-{n}.part", std::process::id()))
}

fn make_executable(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))?;
    }
    #[cfg(target_os = "macos")]
    {
        // Best effort: files we download ourselves are normally not quarantined.
        let _ = std::process::Command::new("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(path)
            .output();
    }
    let _ = path;
    Ok(())
}

/// Atomically move `tmp` over `dest`. On Windows a running executable cannot be
/// replaced but can be renamed, so fall back to moving the old file aside.
pub(crate) fn atomic_replace(tmp: &Path, dest: &Path) -> std::io::Result<()> {
    make_executable(tmp)?;
    match std::fs::rename(tmp, dest) {
        Ok(()) => Ok(()),
        Err(e) if dest.exists() => {
            let old = dest.with_extension(format!(
                "old-{}",
                TMP_COUNTER.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::rename(dest, &old).map_err(|_| e)?;
            std::fs::rename(tmp, dest)?;
            let _ = std::fs::remove_file(&old);
            Ok(())
        }
        Err(e) => Err(e),
    }
}

/// Remove leftovers (`.old-*` from replaced executables, stale `.part` files).
pub(crate) fn cleanup_tools_dir(dir: &Path) {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if name.contains(".old-") || (name.starts_with('.') && name.ends_with(".part")) {
            let _ = std::fs::remove_file(e.path());
        }
    }
}

// ---------------------------------------------------------------------------
// Archive extraction (blocking)
// ---------------------------------------------------------------------------

/// Extract the entries whose file name is in `wanted` from a zip into `out_dir`
/// (as temp files). Returns `name -> temp path`.
pub(crate) fn extract_zip(
    archive: &Path,
    wanted: &[String],
    out_dir: &Path,
) -> Result<HashMap<String, PathBuf>> {
    let file = std::fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(std::io::BufReader::new(file))
        .map_err(|e| VideoError::Archive(e.to_string()))?;
    let mut found = HashMap::new();
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| VideoError::Archive(e.to_string()))?;
        if entry.is_dir() {
            continue;
        }
        let Some(path) = entry.enclosed_name() else {
            continue;
        };
        let Some(base) = path.file_name().map(|s| s.to_string_lossy().to_string()) else {
            continue;
        };
        if !wanted.contains(&base) || found.contains_key(&base) {
            continue;
        }
        let tmp = temp_path(out_dir, &base);
        let mut out = std::fs::File::create(&tmp)?;
        std::io::copy(&mut entry, &mut out)?;
        out.sync_all()?;
        found.insert(base, tmp);
    }
    Ok(found)
}

/// Same as [`extract_zip`] for `.tar.xz`.
pub(crate) fn extract_tar_xz(
    archive: &Path,
    wanted: &[String],
    out_dir: &Path,
) -> Result<HashMap<String, PathBuf>> {
    let file = std::fs::File::open(archive)?;
    let xz = lzma_rust2::XzReader::new(std::io::BufReader::with_capacity(1 << 20, file), true);
    let mut tar = tar::Archive::new(xz);
    let mut found = HashMap::new();
    for entry in tar
        .entries()
        .map_err(|e| VideoError::Archive(e.to_string()))?
    {
        let mut entry = entry.map_err(|e| VideoError::Archive(e.to_string()))?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let path = entry
            .path()
            .map_err(|e| VideoError::Archive(e.to_string()))?
            .into_owned();
        let Some(base) = path.file_name().map(|s| s.to_string_lossy().to_string()) else {
            continue;
        };
        if !wanted.contains(&base) || found.contains_key(&base) {
            continue;
        }
        let tmp = temp_path(out_dir, &base);
        let mut out = std::fs::File::create(&tmp)?;
        std::io::copy(&mut entry, &mut out)?;
        out.sync_all()?;
        found.insert(base, tmp);
        if found.len() == wanted.len() {
            break;
        }
    }
    Ok(found)
}

fn install_extracted(
    found: HashMap<String, PathBuf>,
    wanted: &[String],
    tools_dir: &Path,
) -> Result<()> {
    for name in wanted {
        if !found.contains_key(name) {
            for p in found.values() {
                let _ = std::fs::remove_file(p);
            }
            return Err(VideoError::Archive(format!("{name} not found in archive")));
        }
    }
    for (name, tmp) in found {
        atomic_replace(&tmp, &tools_dir.join(&name))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Installers
// ---------------------------------------------------------------------------

/// Latest yt-dlp release info for a channel: (tag, asset url, expected sha256).
pub(crate) async fn ytdlp_latest(
    http: &Http,
    channel: UpdateChannel,
) -> Result<(String, String, String)> {
    let asset = ytdlp_asset()
        .ok_or_else(|| VideoError::Unsupported("no yt-dlp build for this platform".into()))?;
    let repo = ytdlp_repo(channel);
    let tag = http.latest_tag(repo).await?;
    let sums = http.text(&release_url(repo, &tag, "SHA2-256SUMS")).await?;
    let expected = parse_checksums(&sums)
        .remove(asset)
        .ok_or_else(|| VideoError::ChecksumMissing(asset.into()))?;
    Ok((tag.clone(), release_url(repo, &tag, asset), expected))
}

pub(crate) async fn install_ytdlp(
    http: &Http,
    tools_dir: &Path,
    channel: UpdateChannel,
    progress: ProgressFn<'_>,
) -> Result<PathBuf> {
    progress(ToolProgress {
        tool: Tool::YtDlp,
        phase: ToolPhase::Resolving,
        downloaded: 0,
        total: None,
    });
    let (tag, url, expected) = ytdlp_latest(http, channel).await?;
    tracing::info!(%tag, %url, "installing yt-dlp");
    install_single_binary(http, Tool::YtDlp, &url, &expected, tools_dir, progress).await
}

/// Install yt-dlp from an already-resolved release asset (used by updates).
pub(crate) async fn install_ytdlp_from(
    http: &Http,
    tools_dir: &Path,
    url: &str,
    expected: &str,
) -> Result<PathBuf> {
    install_single_binary(http, Tool::YtDlp, url, expected, tools_dir, &|_| {}).await
}

async fn install_single_binary(
    http: &Http,
    tool: Tool,
    url: &str,
    expected: &str,
    tools_dir: &Path,
    progress: ProgressFn<'_>,
) -> Result<PathBuf> {
    tokio::fs::create_dir_all(tools_dir).await?;
    let dest = managed_path(tools_dir, tool);
    let tmp = temp_path(tools_dir, tool.name());
    http.download_verified(tool, url, &tmp, expected, progress)
        .await?;
    let (t, d) = (tmp.clone(), dest.clone());
    tokio::task::spawn_blocking(move || atomic_replace(&t, &d))
        .await
        .map_err(|e| VideoError::Other(e.to_string()))?
        .inspect_err(|_| {
            let _ = std::fs::remove_file(&tmp);
        })?;
    progress(ToolProgress {
        tool,
        phase: ToolPhase::Installed,
        downloaded: 0,
        total: None,
    });
    Ok(dest)
}

pub(crate) async fn install_deno(
    http: &Http,
    tools_dir: &Path,
    progress: ProgressFn<'_>,
) -> Result<PathBuf> {
    let asset = deno_asset()
        .ok_or_else(|| VideoError::Unsupported("no deno build for this platform".into()))?;
    progress(ToolProgress {
        tool: Tool::Deno,
        phase: ToolPhase::Resolving,
        downloaded: 0,
        total: None,
    });
    let repo = "denoland/deno";
    let tag = http.latest_tag(repo).await?;
    let sum_text = http
        .text(&release_url(repo, &tag, &format!("{asset}.sha256sum")))
        .await?;
    let expected = parse_single_checksum(&sum_text)
        .ok_or_else(|| VideoError::ChecksumMissing(asset.clone()))?;
    tracing::info!(%tag, %asset, "installing deno");
    let wanted = vec![Tool::Deno.exe_name()];
    install_archive(
        http,
        Tool::Deno,
        &release_url(repo, &tag, &asset),
        &expected,
        false,
        &wanted,
        tools_dir,
        progress,
    )
    .await?;
    Ok(managed_path(tools_dir, Tool::Deno))
}

#[allow(clippy::too_many_arguments)]
async fn install_archive(
    http: &Http,
    tool: Tool,
    url: &str,
    expected: &str,
    tar_xz: bool,
    wanted: &[String],
    tools_dir: &Path,
    progress: ProgressFn<'_>,
) -> Result<()> {
    tokio::fs::create_dir_all(tools_dir).await?;
    let archive = temp_path(tools_dir, &format!("{}-archive", tool.name()));
    http.download_verified(tool, url, &archive, expected, progress)
        .await?;
    progress(ToolProgress {
        tool,
        phase: ToolPhase::Extracting,
        downloaded: 0,
        total: None,
    });
    let (a, w, d) = (archive.clone(), wanted.to_vec(), tools_dir.to_path_buf());
    let res = tokio::task::spawn_blocking(move || {
        let found = if tar_xz {
            extract_tar_xz(&a, &w, &d)?
        } else {
            extract_zip(&a, &w, &d)?
        };
        install_extracted(found, &w, &d)
    })
    .await
    .map_err(|e| VideoError::Other(e.to_string()));
    let _ = tokio::fs::remove_file(&archive).await;
    res??;
    progress(ToolProgress {
        tool,
        phase: ToolPhase::Installed,
        downloaded: 0,
        total: None,
    });
    Ok(())
}

/// macOS static builds from ffmpeg.martin-riedl.de: resolve the `latest` redirect to a
/// concrete build URL, verify against that build's `.sha256`, extract the binary.
async fn install_martin_riedl(
    http: &Http,
    tools_dir: &Path,
    arch: &str,
    tools: &[Tool],
    progress: ProgressFn<'_>,
) -> Result<()> {
    for &tool in tools {
        let redirect = format!(
            "{MARTIN_RIEDL}/redirect/latest/macos/{arch}/release/{}.zip",
            tool.name()
        );
        let url = http.redirect_target(&redirect).await?;
        let expected = parse_single_checksum(&http.text(&format!("{url}.sha256")).await?)
            .ok_or_else(|| VideoError::ChecksumMissing(format!("{}.zip", tool.name())))?;
        tracing::info!(%url, "installing {}", tool);
        // Archive entries are the bare macOS binary names (`ffmpeg`, `ffprobe`).
        install_archive(
            http,
            tool,
            &url,
            &expected,
            false,
            &[tool.name().to_string()],
            tools_dir,
            progress,
        )
        .await?;
    }
    Ok(())
}

/// Install managed ffmpeg + ffprobe.
pub(crate) async fn install_ffmpeg(
    http: &Http,
    tools_dir: &Path,
    progress: ProgressFn<'_>,
) -> Result<()> {
    let wanted = vec![Tool::Ffmpeg.exe_name(), Tool::Ffprobe.exe_name()];
    progress(ToolProgress {
        tool: Tool::Ffmpeg,
        phase: ToolPhase::Resolving,
        downloaded: 0,
        total: None,
    });
    if cfg!(target_os = "macos") {
        let arch = if std::env::consts::ARCH == "aarch64" {
            "arm64"
        } else {
            "amd64"
        };
        return install_martin_riedl(
            http,
            tools_dir,
            arch,
            &[Tool::Ffmpeg, Tool::Ffprobe],
            progress,
        )
        .await;
    }
    let asset = btbn_asset().ok_or_else(|| {
        VideoError::Unsupported(
            "no managed ffmpeg build for this platform; install ffmpeg and set its path".into(),
        )
    })?;
    let repo = "BtbN/FFmpeg-Builds";
    let tag = http
        .latest_tag(repo)
        .await
        .unwrap_or_else(|_| "latest".into());
    let sums = http
        .text(&release_url(repo, &tag, "checksums.sha256"))
        .await?;
    let expected = parse_checksums(&sums)
        .remove(asset)
        .ok_or_else(|| VideoError::ChecksumMissing(asset.into()))?;
    tracing::info!(%tag, %asset, "installing ffmpeg");
    install_archive(
        http,
        Tool::Ffmpeg,
        &release_url(repo, &tag, asset),
        &expected,
        asset.ends_with(".tar.xz"),
        &wanted,
        tools_dir,
        progress,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn names() -> Vec<String> {
        vec![Tool::Ffmpeg.exe_name(), Tool::Ffprobe.exe_name()]
    }

    #[test]
    fn extracts_wanted_files_from_tar_xz() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("ffmpeg-test-linux64-gpl.tar.xz");
        {
            let f = std::fs::File::create(&archive).unwrap();
            let xz = lzma_rust2::XzWriter::new(f, lzma_rust2::XzOptions::with_preset(1)).unwrap();
            let mut tar = tar::Builder::new(xz);
            for (path, body) in [
                ("ffmpeg-test/bin/ffplay", b"ffplay".as_slice()),
                ("ffmpeg-test/LICENSE.txt", b"GPL".as_slice()),
                (
                    &*format!("ffmpeg-test/bin/{}", Tool::Ffmpeg.exe_name()),
                    b"ffmpeg-bin".as_slice(),
                ),
                (
                    &*format!("ffmpeg-test/bin/{}", Tool::Ffprobe.exe_name()),
                    b"ffprobe-bin".as_slice(),
                ),
            ] {
                let mut h = tar::Header::new_gnu();
                h.set_size(body.len() as u64);
                h.set_mode(0o755);
                h.set_cksum();
                tar.append_data(&mut h, path, body).unwrap();
            }
            tar.into_inner().unwrap().finish().unwrap().flush().unwrap();
        }
        let out = dir.path().join("tools");
        std::fs::create_dir_all(&out).unwrap();
        let found = extract_tar_xz(&archive, &names(), &out).unwrap();
        assert_eq!(found.len(), 2);
        install_extracted(found, &names(), &out).unwrap();
        assert_eq!(
            std::fs::read(out.join(Tool::Ffmpeg.exe_name())).unwrap(),
            b"ffmpeg-bin"
        );
        assert_eq!(
            std::fs::read(out.join(Tool::Ffprobe.exe_name())).unwrap(),
            b"ffprobe-bin"
        );
        assert!(!out.join("ffplay").exists());
        // No temp leftovers.
        assert_eq!(std::fs::read_dir(&out).unwrap().count(), 2);
    }

    #[test]
    fn extracts_wanted_files_from_zip_and_reports_missing() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("deno.zip");
        {
            let f = std::fs::File::create(&archive).unwrap();
            let mut z = zip::ZipWriter::new(f);
            let o = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);
            z.start_file(Tool::Deno.exe_name(), o).unwrap();
            z.write_all(b"deno-bin").unwrap();
            z.finish().unwrap();
        }
        let out = dir.path().join("tools");
        std::fs::create_dir_all(&out).unwrap();
        let wanted = vec![Tool::Deno.exe_name()];
        let found = extract_zip(&archive, &wanted, &out).unwrap();
        install_extracted(found, &wanted, &out).unwrap();
        assert_eq!(
            std::fs::read(out.join(Tool::Deno.exe_name())).unwrap(),
            b"deno-bin"
        );
        // ffmpeg is not inside -> error, and no temp files remain.
        let found = extract_zip(&archive, &names(), &out).unwrap();
        assert!(install_extracted(found, &names(), &out).is_err());
        assert_eq!(std::fs::read_dir(&out).unwrap().count(), 1);
    }

    #[test]
    fn atomic_replace_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("tool.exe");
        std::fs::write(&dest, b"old").unwrap();
        let tmp = temp_path(dir.path(), "tool");
        std::fs::write(&tmp, b"new").unwrap();
        atomic_replace(&tmp, &dest).unwrap();
        assert_eq!(std::fs::read(&dest).unwrap(), b"new");
        assert!(!tmp.exists());
    }

    #[test]
    fn resolution_order() {
        let dir = tempfile::tempdir().unwrap();
        let opts = VideoOptions::default();
        // Nothing managed: falls through to PATH or Missing.
        let (_, src, _) = resolve(Tool::Deno, dir.path(), &opts);
        assert!(matches!(src, ToolSource::System | ToolSource::Missing));
        // Managed copy wins over PATH.
        std::fs::write(managed_path(dir.path(), Tool::Deno), b"x").unwrap();
        let (p, src, _) = resolve(Tool::Deno, dir.path(), &opts);
        assert_eq!(src, ToolSource::Managed);
        assert_eq!(p.unwrap(), managed_path(dir.path(), Tool::Deno));
        // Custom path wins over managed; a directory is accepted for ffmpeg (ffprobe next to it).
        let custom = dir.path().join("custom");
        std::fs::create_dir_all(&custom).unwrap();
        std::fs::write(custom.join(Tool::Ffmpeg.exe_name()), b"x").unwrap();
        std::fs::write(custom.join(Tool::Ffprobe.exe_name()), b"x").unwrap();
        let o = VideoOptions {
            ffmpeg_path: Some(custom.clone()),
            ..Default::default()
        };
        assert_eq!(resolve(Tool::Ffmpeg, dir.path(), &o).1, ToolSource::Custom);
        let (p, src, _) = resolve(Tool::Ffprobe, dir.path(), &o);
        assert_eq!(src, ToolSource::Custom);
        assert_eq!(p.unwrap(), custom.join(Tool::Ffprobe.exe_name()));
        // A bad custom path falls back but says so.
        let o = VideoOptions {
            deno_path: Some(dir.path().join("nope.exe")),
            ..Default::default()
        };
        let (_, src, msg) = resolve(Tool::Deno, dir.path(), &o);
        assert_eq!(src, ToolSource::Managed);
        assert!(msg.unwrap().contains("not found"));
    }

    #[test]
    fn options_treat_empty_strings_as_unset() {
        let o: VideoOptions = serde_json::from_str(
            r#"{"ytdlpPath":"","ffmpegPath":"  ","proxy":"http://p:8080","channel":"stable"}"#,
        )
        .unwrap();
        assert_eq!(o.ytdlp_path, None);
        assert_eq!(o.ffmpeg_path, None);
        assert_eq!(o.proxy.as_deref(), Some("http://p:8080"));
        assert_eq!(o.channel, UpdateChannel::Stable);
        assert_eq!(o.concurrent_fragments, 8);
        assert!(o.prefer_system_ffmpeg);
    }

    /// Real macOS source (any host OS): redirect + per-build checksum + zip extraction (~28 MB).
    #[tokio::test]
    #[ignore]
    async fn martin_riedl_macos_ffprobe_download_and_extract() {
        let dir = tempfile::tempdir().unwrap();
        let http = Http::new(&VideoOptions::default()).unwrap();
        install_martin_riedl(&http, dir.path(), "arm64", &[Tool::Ffprobe], &|_| {})
            .await
            .unwrap();
        let bin = std::fs::read(dir.path().join("ffprobe")).unwrap();
        // Mach-O 64-bit magic (little endian CF FA ED FE).
        assert_eq!(&bin[..4], &[0xcf, 0xfa, 0xed, 0xfe]);
        eprintln!("ffprobe (macOS arm64) {} bytes", bin.len());
    }

    /// Real BtbN Linux asset: checksum-verified download + pure-Rust xz/tar extraction (~156 MB).
    #[tokio::test]
    #[ignore]
    async fn btbn_linux_tar_xz_download_and_extract() {
        let dir = tempfile::tempdir().unwrap();
        let http = Http::new(&VideoOptions::default()).unwrap();
        let asset = "ffmpeg-master-latest-linux64-gpl.tar.xz";
        let repo = "BtbN/FFmpeg-Builds";
        let tag = http.latest_tag(repo).await.unwrap();
        let sums = http
            .text(&release_url(repo, &tag, "checksums.sha256"))
            .await
            .unwrap();
        let expected = parse_checksums(&sums).remove(asset).unwrap();
        let archive = dir.path().join(asset);
        http.download_verified(
            Tool::Ffmpeg,
            &release_url(repo, &tag, asset),
            &archive,
            &expected,
            &|_| {},
        )
        .await
        .unwrap();
        let t0 = std::time::Instant::now();
        let wanted = vec!["ffmpeg".to_string(), "ffprobe".to_string()];
        let found = extract_tar_xz(&archive, &wanted, dir.path()).unwrap();
        eprintln!("extracted in {:?}", t0.elapsed());
        assert_eq!(found.len(), 2);
        for p in found.values() {
            let head = std::fs::read(p).unwrap();
            assert_eq!(&head[..4], b"\x7fELF");
        }
    }
}
