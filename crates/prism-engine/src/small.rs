//! Reading a small file straight into memory, with a download's own headers and cookies (a
//! `.torrent` file a browser link points to: the site often needs the browser's cookies).

use url::Url;

use crate::config::EngineConfig;
use crate::error::EngineError;
use crate::http::base_headers;
use crate::http::client::{ClientSpec, base_tls_config, build_client};
use crate::http::fetcher::error_chain;
use crate::request::DownloadRequest;

/// A small file read into memory.
#[derive(Debug, Clone)]
pub struct SmallFile {
    /// The whole body.
    pub bytes: Vec<u8>,
    /// Where the request ended up after redirects.
    pub final_url: Url,
    /// The `Content-Type` the server sent, if any.
    pub mime: Option<String>,
}

/// GETs `req.url` with its headers, cookies, referer, user agent and proxy, and returns the
/// body when it is at most `max` bytes.
pub async fn fetch_small_file(
    cfg: &EngineConfig,
    req: &DownloadRequest,
    max: usize,
) -> Result<SmallFile, EngineError> {
    let spec = ClientSpec {
        proxy: req
            .proxy
            .clone()
            .unwrap_or_else(|| cfg.default_proxy.clone()),
        http: req.http,
        connect_timeout: cfg.connect_timeout,
        read_timeout: cfg.read_timeout,
        user_agent: req
            .user_agent
            .clone()
            .filter(|u| !u.is_empty())
            .unwrap_or_else(|| cfg.user_agent.clone()),
        tls: base_tls_config().map_err(|e| EngineError::Network {
            message: format!("TLS setup failed: {e}"),
        })?,
        pool_max_idle: 1,
    };
    let client = build_client(&spec)?;
    let headers = base_headers(&req.headers, req.cookies.as_deref(), req.referer.as_deref())?;
    let mut resp = client
        .get(req.url.clone())
        .headers(headers)
        .send()
        .await
        .map_err(|e| EngineError::network(error_chain(&e)))?;
    let status = resp.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(match status {
            401 | 407 => EngineError::AuthRequired,
            s => EngineError::Http { status: s },
        });
    }
    let too_large = || EngineError::Unsupported {
        message: "the file is too large".into(),
    };
    if resp.content_length().is_some_and(|l| l > max as u64) {
        return Err(too_large());
    }
    let final_url = resp.url().clone();
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let mut bytes = Vec::new();
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| EngineError::network(error_chain(&e)))?
    {
        if bytes.len() + chunk.len() > max {
            return Err(too_large());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(SmallFile {
        bytes,
        final_url,
        mime,
    })
}
