// Local test site: a page with a downloadable .zip link, a <video>, images and links.
import { createServer } from 'node:http';

const ZIP_SIZE = 2 * 1024 * 1024;
const MP4_SIZE = 300 * 1024;

const page = (origin) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Prism e2e page</title>
<style>body{font:15px system-ui;margin:24px;background:#fafafa} video{display:block;background:#123;margin:40px 0}</style></head>
<body>
  <h1>Prism e2e</h1>
  <p id="sel">Selection: <a id="sel-link" href="/files/selected.7z">selected archive</a> and text link ${origin}/files/plain-text.iso here.</p>
  <p><a id="zip" href="/files/test.zip">Download test.zip</a> · <a id="pdf-page" href="/about.html">About page</a> · <a href="https://example.org/ext.rar">external rar</a></p>
  <p><img src="/img/a.png" alt="first" width="40" height="40"> <img src="/img/b.png" alt="second" width="40" height="40"></p>
  <video id="vid" src="/media/clip.mp4" width="640" height="360" controls preload="auto" muted></video>
  <p style="height:600px">filler</p>
</body></html>`;

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

export async function startSite() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const origin = `http://${req.headers.host}`;
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'session=abc123; Path=/' });
      return res.end(page(origin));
    }
    if (url.pathname === '/about.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<p>about</p>');
    }
    if (url.pathname.startsWith('/files/')) {
      const name = url.pathname.split('/').pop();
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': ZIP_SIZE,
      });
      // Stream slowly so the browser cannot finish before the extension decides.
      let sent = 0;
      const tick = () => {
        if (res.destroyed) return;
        const n = Math.min(64 * 1024, ZIP_SIZE - sent);
        sent += n;
        if (sent >= ZIP_SIZE) return res.end(Buffer.alloc(n));
        res.write(Buffer.alloc(n));
        setTimeout(tick, 50);
      };
      return tick();
    }
    if (url.pathname === '/media/clip.mp4') {
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Math.min(Number(range[2]), MP4_SIZE - 1) : MP4_SIZE - 1;
      const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${MP4_SIZE}`;
      res.writeHead(range ? 206 : 200, headers);
      return res.end(Buffer.alloc(end - start + 1));
    }
    if (url.pathname.startsWith('/img/')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () => {
      server.closeAllConnections?.();
      return new Promise((r) => server.close(r));
    },
  };
}
