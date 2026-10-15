//! Tiny rotating file logger (`<data dir>/logs/native-host.log`, rotated to
//! `.log.1` at 1 MiB). Never writes to stdout — stdout carries protocol frames.
//! Debug lines are only written when `PRISM_HOST_DEBUG=1`.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG_BYTES: u64 = 1024 * 1024;

struct Logger {
    path: Option<PathBuf>,
    debug: bool,
    lock: Mutex<()>,
}

static LOGGER: OnceLock<Logger> = OnceLock::new();

fn logger() -> &'static Logger {
    LOGGER.get_or_init(|| Logger {
        path: crate::paths::logs_dir().map(|d| d.join("native-host.log")),
        debug: std::env::var(crate::paths::DEBUG_ENV)
            .is_ok_and(|v| v == "1" || v.eq_ignore_ascii_case("true")),
        lock: Mutex::new(()),
    })
}

/// Whether debug logging is enabled.
pub fn debug_enabled() -> bool {
    logger().debug
}

/// Writes one line at `level`. Errors are swallowed (logging must never break the host).
pub fn log(level: &str, msg: &str) {
    let l = logger();
    if level == "DEBUG" && !l.debug {
        return;
    }
    let Some(path) = &l.path else { return };
    let _g = l.lock.lock();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if fs::metadata(path)
        .map(|m| m.len() > MAX_LOG_BYTES)
        .unwrap_or(false)
    {
        let _ = fs::rename(path, path.with_extension("log.1"));
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let _ = writeln!(f, "{ts} [{}] {level} {msg}", std::process::id());
    }
}

#[macro_export]
macro_rules! log_info { ($($t:tt)*) => { $crate::logger::log("INFO", &format!($($t)*)) } }
#[macro_export]
macro_rules! log_error { ($($t:tt)*) => { $crate::logger::log("ERROR", &format!($($t)*)) } }
#[macro_export]
macro_rules! log_debug { ($($t:tt)*) => { if $crate::logger::debug_enabled() { $crate::logger::log("DEBUG", &format!($($t)*)) } } }
