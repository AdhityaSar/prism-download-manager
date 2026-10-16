// End-to-end test: real Chromium (Playwright's build) + unpacked extension +
// real prism-native-host binary + mock app.
//
//   npm run build && cargo build -p prism-native-host --release && npm run e2e
//
// Env: PRISM_E2E_HEADED=1 to watch, PRISM_HOST_EXE=<path> to use another host binary,
//      PRISM_E2E_BROWSERS=chromium[,chrome] registry keys to register (Windows).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { startMockApp } from './mock-app.mjs';
import { startSite } from './site.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'artifacts');
const extDir = resolve(here, '..', 'build', 'chromium');
const repo = resolve(here, '..', '..');
const EXPECTED_ID = 'mmcdeiglkbfbicdjboocmhehodogilfl';
const hostExe =
  process.env.PRISM_HOST_EXE ??
  [join(repo, 'target', 'release', 'prism-native-host.exe'), join(repo, 'target', 'release', 'prism-native-host'), join(repo, 'target', 'debug', 'prism-native-host.exe'), join(repo, 'target', 'debug', 'prism-native-host')].find(existsSync);
const headed = process.env.PRISM_E2E_HEADED === '1';
// Optional: a specific Chromium/Chrome-for-Testing executable (branded Chrome/Edge can't side-load extensions).
const chromePath = process.env.PRISM_E2E_CHROME_PATH;
// Playwright's Chromium (a Chrome for Testing build) reads HKCU\Software\Chromium\NativeMessagingHosts.
const browsers = process.env.PRISM_E2E_BROWSERS ?? 'chromium';

if (!existsSync(join(extDir, 'manifest.json'))) throw new Error('build the extension first: npm run build');
if (!hostExe) throw new Error('build the host first: cargo build -p prism-native-host --release');

const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true, ms: Date.now() - t, info });
    console.log(`  ✔ ${name}${info ? ` — ${info}` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, info: e.message });
    console.log(`  ✘ ${name}\n    ${e.stack ?? e}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeoutMs = 5000, what = 'condition') {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(50);
  }
}

// ---- registry backup/restore (Windows) -----------------------------------------
const REG_KEYS = { chromium: 'HKCU\\Software\\Chromium\\NativeMessagingHosts\\dev.prism.host', chrome: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\dev.prism.host' };
function regRead(key) {
  try {
    const out = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return /REG_SZ\s+(.*)/.exec(out)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}
function regExists(key) {
  try {
    execFileSync('reg', ['query', key], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const parentOf = (key) => key.slice(0, key.lastIndexOf('\\'));
function regRestore(key, value) {
  if (value === null) {
    try {
      execFileSync('reg', ['delete', key, '/f'], { stdio: 'ignore' });
    } catch {
      /* absent */
    }
  } else execFileSync('reg', ['add', key, '/ve', '/d', value, '/f'], { stdio: 'ignore' });
}

// ---- setup ---------------------------------------------------------------------
mkdirSync(shots, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'prism-e2e-'));
const dataDir = join(tmp, 'data');
const profile = join(tmp, 'profile');
const nmDir = join(tmp, 'nm');
const dlDir = join(tmp, 'downloads');
const backups = {};
const parentExisted = {};
let context;
let mock;
let site;

console.log(`Prism e2e\n  extension: ${extDir}\n  host:      ${hostExe}\n  temp:      ${tmp}`);
try {
  mock = await startMockApp(dataDir);
  site = await startSite();

  if (process.platform === 'win32') {
    for (const b of browsers.split(',')) {
      backups[b] = regRead(REG_KEYS[b]);
      parentExisted[b] = regExists(parentOf(REG_KEYS[b]));
    }
  }
  const reg = execFileSync(hostExe, ['register', '--browsers', browsers, '--manifest-dir', nmDir, '--extension-id-chrome', EXPECTED_ID], {
    encoding: 'utf8',
    env: { ...process.env, PRISM_DATA_DIR: dataDir },
  });
  const regStatus = JSON.parse(reg);
  assert.ok(regStatus.every((s) => s.registered && s.pointsToThisHost), `registration failed: ${reg}`);
  console.log(`  registered host for: ${regStatus.map((s) => `${s.browser} (${s.location})`).join(', ')}`);

  const t0 = Date.now();
  context = await chromium.launchPersistentContext(profile, {
    ...(chromePath ? { executablePath: chromePath } : { channel: 'chromium' }),
    headless: !headed,
    acceptDownloads: true,
    downloadsPath: dlDir,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    env: { ...process.env, PRISM_DATA_DIR: dataDir, PRISM_APP_PATH: join(tmp, 'no-app.exe'), PRISM_HOST_DEBUG: '1' },
    viewport: { width: 1280, height: 900 },
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 10000 }));
  const extId = new URL(sw.url()).host;
  console.log(`  browser up in ${Date.now() - t0} ms, extension id ${extId}`);

  await step('extension has the stable ID from the manifest key', async () => {
    assert.equal(extId, EXPECTED_ID);
  });

  await step('service worker says hello to the app through the native host', async () => {
    const { msg } = await mock.waitFor((m) => m.type === 'hello', 10000);
    assert.equal(msg.protocol, 1);
    assert.equal(msg.noLaunch, true);
    assert.ok(msg.id && msg.version && msg.browser && msg.userAgent);
    await until(() => sw.evaluate(() => globalThis.__prism.getConnection().state === 'connected'), 5000, 'connected state');
    return `browser=${msg.browser}`;
  });

  const page = await context.newPage();
  // Playwright routes downloads through CDP (Browser.setDownloadBehavior=allowAndName), which bypasses
  // the extension downloads hooks. Restore Chrome's normal download pipeline.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'default' });
  await page.goto(`${site.origin}/`);
  const tabId = await sw.evaluate(async (origin) => (await chrome.tabs.query({ url: `${origin}/*` }))[0]?.id, site.origin);

  // Warm-up: the port is already open (hello), so measure a realistic click.
  await step('(1) clicking a .zip link hands it to the app and cancels the browser download', async () => {
    const since = Date.now();
    let browserDownload = null;
    page.once('download', (d) => (browserDownload = d));
    await page.evaluate(() => {
      window.__clickAt = 0;
      document.getElementById('zip').addEventListener('mousedown', () => (window.__clickAt = Date.now()), { once: true });
    });
    await page.click('#zip');
    const { msg, receivedAt } = await mock.waitFor((m) => m.type === 'download', 3000, { since });
    const clickAt = await page.evaluate(() => window.__clickAt);
    const latency = receivedAt - clickAt;
    assert.equal(msg.url, `${site.origin}/files/test.zip`);
    assert.equal(msg.referrer, `${site.origin}/`);
    assert.equal(msg.pageUrl, `${site.origin}/`);
    assert.equal(msg.filename, 'test.zip');
    assert.equal(msg.mime, 'application/zip');
    assert.equal(msg.fileSize, 2 * 1024 * 1024);
    assert.equal(msg.method, 'GET');
    assert.equal(msg.source, 'capture');
    assert.equal(msg.incognito, false);
    assert.match(msg.cookies, /(^|; )session=abc123(;|$)/);
    assert.ok(msg.userAgent.includes('Chrome'));
    assert.ok(latency < 1000, `latency ${latency} ms`);
    // The browser download must be cancelled and erased.
    await sleep(1200);
    const items = await sw.evaluate(async (u) => (await chrome.downloads.search({ url: u })).map((d) => ({ state: d.state, error: d.error })), msg.url);
    assert.ok(items.every((d) => d.state === 'interrupted'), `browser download still alive: ${JSON.stringify(items)}`);
    const files = existsSync(dlDir) ? readdirSync(dlDir) : [];
    assert.equal(files.length, 0, `files in download dir: ${files}`);
    const timing = await sw.evaluate(() => globalThis.__prism.lastCapture);
    console.log(`    click → app latency: ${latency} ms (extension decide ${timing.decidedMs?.toFixed(1)} ms, decide → delivered ${timing.deliveredMs?.toFixed(1)} ms); browser items after: ${JSON.stringify(items)}; playwright saw download event: ${!!browserDownload}`);
    return `${latency} ms click→app`;
  });

  await step('(1b) Alt+click (bypass key) lets the browser keep the download', async () => {
    const since = Date.now();
    await page.click('#sel-link', { modifiers: ['Alt'] });
    await sleep(1500);
    assert.ok(!mock.messages.some((m) => m.receivedAt >= since && m.msg.type === 'download'), 'download was captured despite bypass');
    const items = await sw.evaluate(async (o) => (await chrome.downloads.search({ url: `${o}/files/selected.7z` })).map((d) => d.state), site.origin);
    assert.ok(items.length >= 1 && items.every((s) => s !== 'interrupted'), `browser download missing: ${items}`);
    await sw.evaluate(async (o) => {
      for (const d of await chrome.downloads.search({ url: `${o}/files/selected.7z` })) {
        await chrome.downloads.cancel(d.id).catch(() => {});
        await chrome.downloads.erase({ id: d.id });
      }
    }, site.origin);
    return `browser download state: ${items.join(',')}`;
  });

  await step('(2) video button appears on hover and sends the sniffed stream', async () => {
    await page.locator('#vid').scrollIntoViewIfNeeded();
    // the <video> request must have been sniffed
    await until(() => sw.evaluate(async (id) => {
      const r = await chrome.storage.session.get(`media:${id}`);
      return (r[`media:${id}`] ?? []).some((m) => m.url.endsWith('/media/clip.mp4'));
    }, tabId), 5000, 'sniffed clip.mp4');
    const box = await page.locator('#vid').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 5);
    const pill = page.locator('[data-prism-video-button] .pill');
    await pill.waitFor({ state: 'visible', timeout: 3000 });
    const pillBox = await pill.boundingBox();
    assert.ok(pillBox.x + pillBox.width <= box.x + box.width + 1, 'pill should align to the right edge of the video');
    const since = Date.now();
    await pill.click();
    const item = page.locator('[data-prism-video-button] .item').first();
    await item.waitFor({ state: 'visible', timeout: 3000 });
    const label = await item.locator('.l').textContent();
    await page.screenshot({ path: join(shots, 'video-button-menu.png'), clip: { x: box.x - 20, y: Math.max(0, box.y - 70), width: box.width + 40, height: box.height + 90 } });
    await item.click();
    const { msg } = await mock.waitFor((m) => m.type === 'video', 3000, { since });
    assert.equal(msg.pageUrl, `${site.origin}/`);
    assert.equal(msg.streams.length, 1);
    assert.ok(msg.streams[0].url.endsWith('/media/clip.mp4'));
    assert.equal(msg.streams[0].kind, 'direct');
    assert.equal(msg.streams[0].size, 300 * 1024);
    assert.match(msg.cookies, /session=abc123/);
    await page.locator('[data-prism-video-button] .pill.done').waitFor({ timeout: 2000 });
    return `menu item "${label}"`;
  });

  await step('(2a) on a feed the button offers the hovered video, not the bigger autoplaying ad above it', async () => {
    const feed = await context.newPage();
    try {
      await feed.goto(`${site.origin}/feed.html`);
      const feedTab = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0]?.id, `${site.origin}/feed.html`);
      // both players' requests are sniffed (the ad is the largest stream in the tab)
      await until(() => sw.evaluate(async (id) => {
        const list = (await chrome.storage.session.get(`media:${id}`))[`media:${id}`] ?? [];
        return list.some((m) => m.url.endsWith('/media/ad.mp4')) && list.some((m) => m.url.endsWith('/media/post-640p.mp4'));
      }, feedTab), 5000, 'sniffed ad.mp4 and post-640p.mp4');
      await feed.locator('#post').scrollIntoViewIfNeeded();
      const box = await feed.locator('#post').boundingBox();
      await feed.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await feed.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 5);
      const pill = feed.locator('[data-prism-video-button] .pill');
      await pill.waitFor({ state: 'visible', timeout: 3000 });
      await pill.click();
      const items = feed.locator('[data-prism-video-button] .item');
      await items.first().waitFor({ state: 'visible', timeout: 3000 });
      const menu = await feed.locator('[data-prism-video-button] .menu > *').evaluateAll((els) => els.map((e) => `${e.className}: ${e.textContent.trim()}`));
      await feed.screenshot({ path: join(shots, 'video-button-feed.png'), clip: { x: box.x - 20, y: Math.max(0, box.y - 70), width: box.width + 40, height: box.height + 140 } });
      const groups = menu.filter((l) => l.startsWith('group:'));
      assert.equal(groups[0], 'group: This video', `menu: ${menu.join(' | ')}`);
      // This video: its qualities from data-sources, best first; the ad only under "Other streams".
      const own = menu.slice(menu.indexOf('group: This video') + 1, menu.indexOf('group: Other streams on this page'));
      assert.deepEqual(own.map((l) => /\d+p/.exec(l)?.[0]), ['720p', '640p', '360p'], `menu: ${menu.join(' | ')}`);
      assert.ok(menu.slice(menu.indexOf('group: Other streams on this page')).some((l) => l.includes('ad.mp4')), `menu: ${menu.join(' | ')}`);
      const since = Date.now();
      await items.first().click();
      const { msg } = await mock.waitFor((m) => m.type === 'video', 3000, { since });
      assert.equal(msg.pageUrl, `${site.origin}/feed.html`);
      assert.equal(msg.streams.length, 1);
      assert.equal(msg.streams[0].url, `${site.origin}/media/post-720p.mp4`);
      assert.equal(msg.streams[0].headers?.Referer, `${site.origin}/feed.html`);
      return `menu: ${menu.join(' | ')}`;
    } finally {
      await feed.close();
    }
  });

  await step('(2b) on a "video site" the button lists app formats (probeVideo) and sends the chosen formatId', async () => {
    // Treat the test origin as a yt-dlp site (local override), then reload so the content script starts fresh.
    await sw.evaluate(async () => {
      const k = 'prism.state';
      const st = (await chrome.storage.local.get(k))[k];
      await chrome.storage.local.set({ [k]: { ...st, settingsSource: 'local', settings: { ...st.settings, videoSites: ['127.0.0.1'] } } });
    });
    await page.reload();
    await page.locator('#vid').scrollIntoViewIfNeeded();
    const box = await page.locator('#vid').boundingBox();
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.move(box.x + 120, box.y + 110);
    const pill = page.locator('[data-prism-video-button] .pill');
    await pill.waitFor({ state: 'visible', timeout: 3000 });
    const since = Date.now();
    await pill.click();
    const { msg: probe } = await mock.waitFor((m) => m.type === 'probeVideo', 3000, { since });
    assert.equal(probe.pageUrl, `${site.origin}/`);
    const item = page.locator('[data-prism-video-button] .item', { hasText: '1080p' });
    await item.waitFor({ state: 'visible', timeout: 3000 });
    const labels = await page.locator('[data-prism-video-button] .item .l').allTextContents();
    await page.screenshot({ path: join(shots, 'video-button-formats.png'), clip: { x: box.x - 20, y: Math.max(0, box.y - 70), width: box.width + 40, height: box.height + 90 } });
    await item.click();
    const { msg } = await mock.waitFor((m) => m.type === 'video' && m.formatId, 3000, { since });
    assert.equal(msg.formatId, '137+140');
    assert.equal(msg.formatLabel, '1080p · MP4 · 145 MB');
    assert.deepEqual(msg.streams, []);
    assert.equal(msg.title, 'Mock video');
    assert.match(msg.cookies, /session=abc123/);
    // back to app-managed settings
    await sw.evaluate(() => globalThis.__prism.hello(true, true));
    return `menu: ${labels.join(' | ')}`;
  });

  await step('(3) batch collection ("all links" / "selection") via direct trigger', async () => {
    let since = Date.now();
    const count = await sw.evaluate((id) => globalThis.__prism.collectAndSend(id, 'links'), tabId);
    let { msg } = await mock.waitFor((m) => m.type === 'batch', 3000, { since });
    assert.equal(msg.kind, 'links');
    assert.equal(msg.pageUrl, `${site.origin}/`);
    assert.equal(msg.items.length, count);
    const zip = msg.items.find((i) => i.url === `${site.origin}/files/test.zip`);
    assert.ok(zip, 'zip link in batch');
    assert.equal(zip.referrer, `${site.origin}/`);
    assert.equal(zip.filename, 'test.zip');
    assert.match(zip.cookies, /session=abc123/);
    assert.ok(msg.items.some((i) => i.url === 'https://example.org/ext.rar'));
    const links = msg.items.length;
    // images
    since = Date.now();
    await sw.evaluate((id) => globalThis.__prism.collectAndSend(id, 'images'), tabId);
    ({ msg } = await mock.waitFor((m) => m.type === 'batch' && m.kind === 'images', 3000, { since }));
    assert.deepEqual(msg.items.map((i) => i.url).sort(), [`${site.origin}/img/a.png`, `${site.origin}/img/b.png`]);
    // selection links
    await page.evaluate(() => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('sel'));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
    since = Date.now();
    await sw.evaluate((id) => globalThis.__prism.collectAndSend(id, 'selection', 0), tabId);
    ({ msg } = await mock.waitFor((m) => m.type === 'batch' && m.kind === 'selection', 3000, { since }));
    const urls = msg.items.map((i) => i.url).sort();
    assert.deepEqual(urls, [`${site.origin}/files/plain-text.iso`, `${site.origin}/files/selected.7z`]);
    return `${links} links, 2 images, 2 selection links`;
  });

  await step('(4) popup shows the connected state and the page media', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
    await popup.locator('#conn[data-state="connected"]').waitFor({ timeout: 4000 });
    const chipText = await popup.locator('#conn').textContent();
    assert.match(chipText, /Connected/);
    await popup.locator('.media .name', { hasText: 'clip.mp4' }).waitFor({ timeout: 2000 });
    // popup "All videos" button → batch
    const since = Date.now();
    await popup.click('[data-act="collect"][data-mode="videos"]');
    const { msg } = await mock.waitFor((m) => m.type === 'batch' && m.kind === 'videos', 3000, { since });
    assert.ok(msg.items.some((i) => i.url.endsWith('/media/clip.mp4')));
    await popup.setViewportSize({ width: 368, height: 600 });
    await popup.screenshot({ path: join(shots, 'popup-connected.png'), fullPage: true });
    await popup.emulateMedia({ colorScheme: 'dark' });
    await popup.screenshot({ path: join(shots, 'popup-connected-dark.png'), fullPage: true });
    await popup.emulateMedia({ colorScheme: 'light' });
    await popup.close();
    return chipText.trim();
  });

  await step('(5) app down → capture fails open (browser keeps the download) and popup shows the fix hint', async () => {
    await mock.close();
    const since = Date.now();
    await page.click('#zip');
    const zipUrl = `${site.origin}/files/test.zip`;
    // The host tries to launch the (missing) app, gives up, and the extension releases the download.
    const lc = await until(
      () => sw.evaluate((u) => {
        const c = globalThis.__prism.lastCapture;
        return c.url === u && c.result && c.result !== 'pending' ? { ...c } : null;
      }, zipUrl),
      8000,
      'fail-open decision',
    );
    assert.match(lc.result, /fail-open: app_unreachable/);
    await sleep(800);
    const items = await sw.evaluate(async (u) => (await chrome.downloads.search({ url: u })).map((x) => x.state), zipUrl);
    assert.ok(items.length === 1 && items[0] !== 'interrupted', `browser should keep downloading: ${items}`);
    const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
    assert.equal(badge, '!');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
    await popup.locator('#conn[data-state="app_down"]').waitFor({ timeout: 4000 });
    await popup.locator('#fix').waitFor();
    await popup.setViewportSize({ width: 368, height: 600 });
    await popup.screenshot({ path: join(shots, 'popup-disconnected.png'), fullPage: true });
    await popup.close();
    return `${lc.result} after ${Math.round(lc.deliveredMs)} ms; browser download ${items.join(',')}; badge "${badge}"`;
  });

} finally {
  await context?.close().catch(() => {});
  await mock?.close().catch(() => {});
  await site?.close().catch(() => {});
  try {
    execFileSync(hostExe, ['unregister', '--browsers', browsers, '--manifest-dir', nmDir], { stdio: 'ignore', env: { ...process.env, PRISM_DATA_DIR: dataDir } });
  } catch {
    /* ignore */
  }
  for (const [b, v] of Object.entries(backups)) regRestore(REG_KEYS[b], v);
  // Remove the NativeMessagingHosts key we created if it is empty again.
  for (const [b, existed] of Object.entries(parentExisted)) {
    const parent = parentOf(REG_KEYS[b]);
    if (!existed && regExists(parent)) {
      const out = execFileSync('reg', ['query', parent], { encoding: 'utf8' });
      if (!out.toLowerCase().includes(`${parent.toLowerCase().replace('hkcu', 'hkey_current_user')}\\`)) regRestore(parent, null);
    }
  }
  const log = join(dataDir, 'logs', 'native-host.log');
  if (existsSync(log)) {
    const lines = readFileSync(log, 'utf8').trim().split('\n');
    console.log(`  host log (${lines.length} lines, last 5):\n    ${lines.slice(-5).join('\n    ')}`);
  }
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} e2e checks passed (${headed ? 'headed' : 'headless'} Chromium).`);
process.exit(failed.length ? 1 : 0);
