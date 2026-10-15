//! End-to-end tests of the download manager against the local test server:
//! adding, capture dialog flow, pause/resume across an app restart, queues, browser IPC
//! messages and the trash.

use prism_core::events::{CaptureSource, CoreEvent};
use prism_core::ipc::IpcHandler;
use prism_core::manager::{CaptureDecision, Core, CoreOptions, NewItem, StartMode};
use prism_core::model::{Queue, Status};
use prism_testserver::{ServerConfig, TestServer, expected_sha256, sha256_hex};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::sync::broadcast;

async fn core_in(dir: &Path) -> Core {
    let core = Core::start(CoreOptions {
        data_dir: dir.join("data"),
        ipc: false,
        clipboard: false,
    })
    .await
    .unwrap();
    core.update_settings(&serde_json::json!({
        "downloads": {"defaultDir": dir.join("dl"), "useCategoryFolders": false},
        "general": {"showCaptureDialog": false},
        "antivirus": {"enabled": false},
    }))
    .unwrap();
    core
}

fn sha256_file(path: &Path) -> String {
    let data = std::fs::read(path).unwrap();
    sha256_hex(&data)
}

/// Wait until `pred` matches an event (with timeout).
async fn wait_event<T>(
    rx: &mut broadcast::Receiver<CoreEvent>,
    secs: u64,
    mut pred: impl FnMut(&CoreEvent) -> Option<T>,
) -> T {
    tokio::time::timeout(Duration::from_secs(secs), async {
        loop {
            match rx.recv().await {
                Ok(ev) => {
                    if let Some(v) = pred(&ev) {
                        return v;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(e) => panic!("event stream closed: {e}"),
            }
        }
    })
    .await
    .expect("timed out waiting for event")
}

async fn wait_completed(rx: &mut broadcast::Receiver<CoreEvent>, id: &str) -> PathBuf {
    wait_event(rx, 60, |ev| match ev {
        CoreEvent::Completed(item) if item.id == id => Some(item.path()),
        CoreEvent::Failed(item) if item.id == id => panic!("download failed: {:?}", item.error),
        _ => None,
    })
    .await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn add_download_and_verify_content() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let mut rx = core.subscribe();
    let size = 8 << 20;
    let url = server.url(&format!("/file/data.bin?size={size}&seed=7"));
    let items = core
        .add_items(
            vec![NewItem {
                url,
                ..Default::default()
            }],
            StartMode::Now,
        )
        .unwrap();
    let path = wait_completed(&mut rx, &items[0].id).await;
    assert_eq!(sha256_file(&path), expected_sha256(7, size));
    let item = core.item(&items[0].id).unwrap();
    assert_eq!(item.status, Status::Completed);
    assert_eq!(item.size, Some(size));
    assert!(
        server.stats().total_connections() > 1,
        "expected a multi-connection download"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn capture_dialog_flow_uses_probed_name() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let mut rx = core.subscribe();
    let url = server
        .url("/file/x?size=300000&seed=3&cd=attachment%3B%20filename%3D%22report%20final.pdf%22");
    let info = core.capture(
        NewItem {
            url,
            ..Default::default()
        },
        CaptureSource::Browser,
    );
    assert!(info.probing);
    let probed = wait_event(&mut rx, 20, |ev| match ev {
        CoreEvent::CaptureUpdated(c) if c.id == info.id => Some(c.clone()),
        _ => None,
    })
    .await;
    assert_eq!(probed.file_name, "report final.pdf");
    assert_eq!(probed.size, Some(300_000));
    assert_eq!(probed.category, "documents");
    assert_eq!(probed.resumable, Some(true));
    let item = core
        .confirm_capture(CaptureDecision {
            id: info.id.clone(),
            description: Some("Q3".into()),
            ..Default::default()
        })
        .unwrap();
    let path = wait_completed(&mut rx, &item.id).await;
    assert_eq!(path.file_name().unwrap(), "report final.pdf");
    assert_eq!(sha256_file(&path), expected_sha256(3, 300_000));
    assert_eq!(core.item(&item.id).unwrap().description, "Q3");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn pause_then_resume_after_app_restart() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let size: u64 = 6 << 20;
    // 512 KiB/s per connection: slow enough to pause mid-way.
    let url = server.url(&format!(
        "/file/big.bin?size={size}&seed=11&throttle=524288"
    ));
    let id = {
        let core = core_in(tmp.path()).await;
        let items = core
            .add_items(
                vec![NewItem {
                    url,
                    ..Default::default()
                }],
                StartMode::Now,
            )
            .unwrap();
        let id = items[0].id.clone();
        tokio::time::sleep(Duration::from_millis(1500)).await;
        core.pause_items(std::slice::from_ref(&id));
        for _ in 0..100 {
            if core.item(&id).unwrap().status == Status::Paused {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        let item = core.item(&id).unwrap();
        assert_eq!(item.status, Status::Paused);
        assert!(
            item.downloaded > 0 && item.downloaded < size,
            "downloaded {}",
            item.downloaded
        );
        core.shutdown().await;
        id
    };
    // A fresh core over the same data directory = app restart.
    let core = core_in(tmp.path()).await;
    let item = core.item(&id).expect("item persisted");
    assert_eq!(item.status, Status::Paused);
    let before = item.downloaded;
    assert!(before > 0);
    server.reset_stats();
    let mut rx = core.subscribe();
    core.start_items(std::slice::from_ref(&id));
    let path = wait_completed(&mut rx, &id).await;
    assert_eq!(sha256_file(&path), expected_sha256(11, size));
    // The resumed run must not re-download what was already there.
    let resent: u64 = server
        .stats()
        .connections
        .iter()
        .map(|c| c.bytes_sent)
        .sum();
    assert!(
        resent < size - before / 2,
        "resent {resent} bytes, had {before}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn queue_respects_concurrency_and_finishes() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let mut queue: Queue = core.queues().into_iter().find(|q| q.id == "main").unwrap();
    queue.max_concurrent = 2;
    core.upsert_queue(queue).unwrap();
    let entries: Vec<NewItem> = (0..4)
        .map(|i| NewItem {
            url: server.url(&format!(
                "/file/q{i}.bin?size=1500000&seed={i}&throttle=1048576"
            )),
            ..Default::default()
        })
        .collect();
    let items = core
        .add_items(entries, StartMode::Queue("main".into()))
        .unwrap();
    assert!(
        items
            .iter()
            .all(|i| core.item(&i.id).unwrap().status == Status::Idle)
    );
    let mut rx = core.subscribe();
    core.start_queue("main");
    let mut max_active = 0;
    let finished = tokio::time::timeout(Duration::from_secs(60), async {
        loop {
            match rx.recv().await {
                Ok(CoreEvent::Progress(list)) => max_active = max_active.max(list.len()),
                Ok(CoreEvent::QueueFinished { queue_id, .. }) if queue_id == "main" => break true,
                Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                Err(_) => break false,
            }
        }
    })
    .await
    .expect("queue did not finish");
    assert!(finished);
    assert!(max_active <= 2, "queue ran {max_active} downloads at once");
    for (i, item) in items.iter().enumerate() {
        let item = core.item(&item.id).unwrap();
        assert_eq!(item.status, Status::Completed);
        assert_eq!(
            sha256_file(&item.path()),
            expected_sha256(i as u64, 1_500_000)
        );
    }
    assert!(
        !core
            .queues()
            .iter()
            .find(|q| q.id == "main")
            .unwrap()
            .running
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn browser_messages_follow_protocol() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let hello = core
        .handle(serde_json::json!({"id": "1", "type": "hello", "protocol": 1, "browser": "chrome"}))
        .await;
    assert_eq!(hello["ok"], true);
    assert_eq!(hello["protocol"], 1);
    assert!(
        hello["settings"]["extensions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e == "ZIP")
    );

    let mut rx = core.subscribe();
    let url = server.url("/file/pkg.zip?size=200000&seed=5");
    let reply = core
        .handle(serde_json::json!({
            "id": "2", "type": "download", "url": url, "referrer": "https://example.com/page",
            "cookies": "session=abc", "userAgent": "TestBrowser/1.0", "filename": "pkg.zip",
            "fileSize": 200000, "method": "GET", "source": "capture",
        }))
        .await;
    assert_eq!(reply["ok"], true, "{reply}");
    assert_eq!(reply["accepted"], true);
    let id = reply["downloadId"].as_str().unwrap().to_string();
    let path = wait_completed(&mut rx, &id).await;
    assert_eq!(sha256_file(&path), expected_sha256(5, 200_000));
    // Browser context is forwarded to the server.
    let log = server.stats().requests;
    assert!(
        log.iter()
            .all(|r| r.cookie.as_deref() == Some("session=abc"))
    );
    assert!(
        log.iter()
            .all(|r| r.referer.as_deref() == Some("https://example.com/page"))
    );
    assert!(
        log.iter()
            .all(|r| r.user_agent.as_deref() == Some("TestBrowser/1.0"))
    );

    let batch = core
        .handle(serde_json::json!({"id": "3", "type": "batch", "pageUrl": "https://example.com", "title": "t",
            "kind": "links", "items": [{"url": "https://example.com/a.zip"}, {"url": "https://example.com/b.pdf"}]}))
        .await;
    assert_eq!(batch["count"], 2);
    let unknown = core
        .handle(serde_json::json!({"id": "4", "type": "nope"}))
        .await;
    assert_eq!(unknown["ok"], false);
    assert_eq!(unknown["error"]["code"], "bad_request");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn trash_restore_and_permanent_delete() {
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let items = core
        .add_items(
            vec![NewItem {
                url: "https://example.invalid/a.zip".into(),
                ..Default::default()
            }],
            StartMode::Later,
        )
        .unwrap();
    let id = items[0].id.clone();
    core.delete_items(std::slice::from_ref(&id), false, false)
        .await
        .unwrap();
    assert!(core.item(&id).unwrap().trashed);
    core.restore_items(std::slice::from_ref(&id));
    assert!(!core.item(&id).unwrap().trashed);
    core.delete_items(std::slice::from_ref(&id), false, true)
        .await
        .unwrap();
    assert!(core.item(&id).is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn downloads_continue_after_restart_for_update() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let size: u64 = 6 << 20;
    let url = server.url(&format!(
        "/file/upd.bin?size={size}&seed=14&throttle=524288"
    ));
    let (running, idle) = {
        let core = core_in(tmp.path()).await;
        let running = core
            .add_items(
                vec![NewItem {
                    url,
                    ..Default::default()
                }],
                StartMode::Now,
            )
            .unwrap()[0]
            .id
            .clone();
        let idle = core
            .add_items(
                vec![NewItem {
                    url: "https://example.invalid/later.zip".into(),
                    ..Default::default()
                }],
                StartMode::Later,
            )
            .unwrap()[0]
            .id
            .clone();
        tokio::time::sleep(Duration::from_millis(1500)).await;
        core.shutdown_for_restart().await;
        (running, idle)
    };
    // New version starts: the running download continues by itself, the idle one doesn't.
    let core = core_in(tmp.path()).await;
    let mut rx = core.subscribe();
    let item = core.item(&running).unwrap();
    assert_ne!(
        item.status,
        Status::Paused,
        "should continue without a click"
    );
    let path = wait_completed(&mut rx, &running).await;
    assert_eq!(sha256_file(&path), expected_sha256(14, size));
    assert_ne!(core.item(&idle).unwrap().status, Status::Downloading);
    // A normal restart afterwards doesn't start anything again.
    assert!(
        !tmp.path()
            .join("data")
            .join("resume-after-restart.json")
            .exists()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn running_download_survives_trash_and_restore() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let size: u64 = 6 << 20;
    let url = server.url(&format!(
        "/file/trash.bin?size={size}&seed=12&throttle=524288"
    ));
    let items = core
        .add_items(
            vec![NewItem {
                url,
                ..Default::default()
            }],
            StartMode::Now,
        )
        .unwrap();
    let id = items[0].id.clone();
    tokio::time::sleep(Duration::from_millis(1500)).await;
    // Trash it while it is downloading.
    core.delete_items(std::slice::from_ref(&id), false, false)
        .await
        .unwrap();
    let mut saved = false;
    for _ in 0..100 {
        let item = core.item(&id).unwrap();
        if item.resume.is_some() && item.downloaded > 0 {
            saved = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let item = core.item(&id).unwrap();
    assert!(item.trashed);
    assert_eq!(item.status, Status::Paused);
    assert!(saved, "trashing must keep the resume point");
    let before = item.downloaded;
    // Restore and continue: same file, not restarted.
    core.restore_items(std::slice::from_ref(&id));
    assert!(!core.item(&id).unwrap().trashed);
    server.reset_stats();
    let mut rx = core.subscribe();
    core.start_items(std::slice::from_ref(&id));
    let path = wait_completed(&mut rx, &id).await;
    assert_eq!(path.file_name().unwrap(), "trash.bin");
    assert_eq!(sha256_file(&path), expected_sha256(12, size));
    let resent: u64 = server
        .stats()
        .connections
        .iter()
        .map(|c| c.bytes_sent)
        .sum();
    assert!(
        resent < size - before / 2,
        "resent {resent} bytes, had {before}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn removing_an_unfinished_download_removes_its_partial_file() {
    let server = TestServer::start(ServerConfig::default()).await.unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let size: u64 = 6 << 20;
    let url = server.url(&format!(
        "/file/gone.bin?size={size}&seed=13&throttle=524288"
    ));
    let id = core
        .add_items(
            vec![NewItem {
                url,
                ..Default::default()
            }],
            StartMode::Now,
        )
        .unwrap()[0]
        .id
        .clone();
    tokio::time::sleep(Duration::from_millis(1500)).await;
    core.pause_items(std::slice::from_ref(&id));
    for _ in 0..100 {
        if core.item(&id).unwrap().resume.is_some() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let part = tmp.path().join("dl").join("gone.bin.prismpart");
    assert!(part.exists(), "partial file expected at {}", part.display());
    // Trash, then empty the trash ("delete files" not ticked).
    core.delete_items(std::slice::from_ref(&id), false, false)
        .await
        .unwrap();
    assert!(
        part.exists(),
        "the trash keeps the partial file for restoring"
    );
    core.empty_trash().await.unwrap();
    assert!(core.item(&id).is_none());
    assert!(
        !part.exists(),
        "an unfinished download's partial file must not be left behind"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn batch_pattern_expands() {
    let tmp = tempfile::tempdir().unwrap();
    let core = core_in(tmp.path()).await;
    let batch = core
        .batch_from_pattern("https://example.com/file[01-12].zip")
        .unwrap();
    assert_eq!(batch.entries.len(), 12);
    assert_eq!(batch.entries[0].file_name, "file01.zip");
    assert_eq!(batch.entries[0].category, "compressed");
}
