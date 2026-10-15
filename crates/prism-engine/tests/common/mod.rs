//! Shared helpers for the integration tests.
#![allow(dead_code)]

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use prism_engine::{
    Completed, DownloadEvent, DownloadHandle, DownloadRequest, Engine, EngineConfig, EngineError,
    Url,
};
use prism_testserver::{ServerConfig, TestServer};
use sha2::{Digest, Sha256};

pub const MIB: u64 = 1 << 20;

pub fn engine() -> Engine {
    Engine::new(EngineConfig {
        connect_timeout: Duration::from_secs(5),
        read_timeout: Duration::from_secs(10),
        ..EngineConfig::default()
    })
}

pub async fn server(cfg: ServerConfig) -> TestServer {
    TestServer::start(cfg).await.expect("start test server")
}

pub async fn default_server() -> TestServer {
    server(ServerConfig::default()).await
}

pub fn request(url: &str, dir: &Path, connections: u8) -> DownloadRequest {
    let mut r = DownloadRequest::new(Url::parse(url).unwrap(), dir);
    r.connections = connections;
    r
}

pub fn sha256_file(path: &Path) -> String {
    let data = std::fs::read(path).unwrap();
    prism_testserver::sha256_hex(&data)
}

pub fn sha256(data: &[u8]) -> String {
    let d = Sha256::digest(data);
    d.iter().map(|b| format!("{b:02x}")).collect()
}

/// Collects all events of a handle in the background.
pub fn collect_events(h: &DownloadHandle) -> Arc<Mutex<Vec<DownloadEvent>>> {
    let events = Arc::new(Mutex::new(Vec::new()));
    let mut rx = h.events();
    let sink = events.clone();
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(e) => sink.lock().unwrap().push(e),
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });
    events
}

pub async fn wait(h: &DownloadHandle, secs: u64) -> Result<Completed, EngineError> {
    tokio::time::timeout(Duration::from_secs(secs), h.wait())
        .await
        .expect("download timed out")
}

/// Waits until at least `bytes` were downloaded.
pub async fn wait_for_progress(h: &DownloadHandle, bytes: u64) {
    tokio::time::timeout(Duration::from_secs(30), async {
        while h.snapshot().downloaded < bytes {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("no progress");
}

pub fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_test_writer()
        .try_init();
}
