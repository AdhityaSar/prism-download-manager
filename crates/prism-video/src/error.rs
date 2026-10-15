use std::path::PathBuf;

use crate::tools::Tool;

/// Errors produced by the video backend.
#[derive(Debug, thiserror::Error)]
pub enum VideoError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("HTTP status {status} for {url}")]
    HttpStatus { status: u16, url: String },

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("{0} is not available (install it or set a custom path)")]
    ToolMissing(Tool),

    #[error("{tool} failed{}: {message}{}", exit_suffix(*code), login_hint(message))]
    ToolFailed {
        tool: Tool,
        code: Option<i32>,
        message: String,
    },

    #[error("checksum mismatch for {file}: expected {expected}, got {actual}")]
    ChecksumMismatch {
        file: String,
        expected: String,
        actual: String,
    },

    #[error("checksum for {0} not found in the published checksum file")]
    ChecksumMissing(String),

    #[error("archive error: {0}")]
    Archive(String),

    #[error("unsupported: {0}")]
    Unsupported(String),

    #[error("the video is DRM protected")]
    Drm,

    #[error("operation cancelled")]
    Cancelled,

    #[error("missing input file for post-processing: {0}")]
    MissingInput(PathBuf),

    #[error("{0}")]
    Other(String),
}

pub type Result<T, E = VideoError> = std::result::Result<T, E>;

impl VideoError {
    /// True when the failure is the user's cancellation rather than an error.
    pub fn is_cancelled(&self) -> bool {
        matches!(self, VideoError::Cancelled)
    }
}

fn exit_suffix(code: Option<i32>) -> String {
    code.map(|c| format!(" (exit code {c})"))
        .unwrap_or_default()
}

/// Sites that need an account: point the user at the cookies setting.
fn login_hint(message: &str) -> &'static str {
    let m = message.to_ascii_lowercase();
    if m.contains("logged-in")
        || m.contains("log in")
        || m.contains("login")
        || m.contains("cookies")
        || m.contains("sign in")
    {
        "

Tip: sign in to the site in your browser, then choose that browser under Settings → Video & streams → Use cookies from browser."
    } else {
        ""
    }
}
