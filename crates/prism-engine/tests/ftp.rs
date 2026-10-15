//! FTP integration tests against an embedded libunftp server (anonymous login, passive mode).

mod common;

use std::time::Duration;

use common::*;
use prism_engine::{EngineError, ResumeKind};
use prism_testserver::{expected_bytes, expected_sha256};

/// Starts an FTP server serving `root`; returns its port.
async fn ftp_server(root: std::path::PathBuf) -> u16 {
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let base = 40_000 + fastrand::u16(0..200) * 100;
    let server = libunftp::ServerBuilder::new(Box::new(move || {
        unftp_sbe_fs::Filesystem::new(root.clone()).unwrap()
    }))
    .passive_ports(base..=base + 99)
    .build()
    .unwrap();
    tokio::spawn(server.listen(format!("127.0.0.1:{port}")));
    // Wait until it accepts connections.
    for _ in 0..100 {
        if tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .is_ok()
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    port
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn ftp_multi_connection_download_and_resume() {
    let root = tempfile::tempdir().unwrap();
    let size = 24 * MIB + 3;
    std::fs::write(
        root.path().join("big file.bin"),
        expected_bytes(31, 0..size),
    )
    .unwrap();
    let port = ftp_server(root.path().to_path_buf()).await;
    let url = format!("ftp://127.0.0.1:{port}/big%20file.bin");

    // Probe.
    let dir = tempfile::tempdir().unwrap();
    let info = engine().probe(&request(&url, dir.path(), 4)).await.unwrap();
    assert_eq!(info.size, Some(size));
    assert!(info.resumable);
    assert_eq!(info.file_name, "big file.bin");

    // Full multi-connection download.
    let h = engine().start(request(&url, dir.path(), 4), None, vec![]);
    let events = collect_events(&h);
    let done = wait(&h, 120).await.unwrap();
    assert_eq!(done.path, dir.path().join("big file.bin"));
    let splits = events
        .lock()
        .unwrap()
        .iter()
        .filter(|e| matches!(e, prism_engine::DownloadEvent::SegmentSplit { .. }))
        .count();
    assert!(
        splits >= 3,
        "expected several REST+RETR connections, got {splits} splits"
    );
    assert_eq!(sha256_file(&done.path), expected_sha256(31, size));

    // Pause (speed limited so it is still running) and resume in a new engine.
    let dir = tempfile::tempdir().unwrap();
    let mut req = request(&url, dir.path(), 4);
    req.speed_limit = 8 * MIB;
    let h = engine().start(req, None, vec![]);
    wait_for_progress(&h, 4 * MIB).await;
    let state = h.pause().await.expect("state");
    assert_eq!(state.kind, ResumeKind::Ftp);
    assert!(state.downloaded() >= 4 * MIB && state.downloaded() < size);
    let done = wait(
        &engine().start(request(&url, dir.path(), 4), Some(state), vec![]),
        120,
    )
    .await
    .unwrap();
    assert_eq!(sha256_file(&done.path), expected_sha256(31, size));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn ftp_missing_file_is_fatal() {
    let root = tempfile::tempdir().unwrap();
    let port = ftp_server(root.path().to_path_buf()).await;
    let dir = tempfile::tempdir().unwrap();
    let h = engine().start(
        request(&format!("ftp://127.0.0.1:{port}/nope.bin"), dir.path(), 4),
        None,
        vec![],
    );
    assert!(matches!(
        wait(&h, 30).await.unwrap_err(),
        EngineError::Ftp { .. }
    ));
}
