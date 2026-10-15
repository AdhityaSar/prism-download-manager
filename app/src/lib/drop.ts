// Dropped links / .torrent files → downloads (main window and drop zone).

import { actions } from "./actions";
import { api } from "./api";
import { bytesToBase64, extractUrls } from "./present";
import { attempt, toast } from "./ui";

/** Shared by the main window and the drop zone. */
export async function handleDrop(dt: DataTransfer) {
  const files = Array.from(dt.files).filter((f) => f.name.toLowerCase().endsWith(".torrent"));
  for (const f of files) {
    const value = bytesToBase64(new Uint8Array(await f.arrayBuffer()));
    const meta = await attempt(api.inspectTorrent({ type: "file", value }), `Could not read ${f.name}`);
    if (meta) {
      const item = await attempt(api.addTorrent({ source: { type: "file", value }, name: meta.name, size: meta.totalSize }), "Could not add the torrent");
      if (item) toast("Torrent added", { kind: "success", body: meta.name });
    }
  }
  const text = dt.getData("text/uri-list") || dt.getData("text/plain");
  const urls = extractUrls(text);
  if (urls.length === 1) await actions.addUrl(urls[0]);
  else if (urls.length > 1) {
    const batch = await attempt(api.batchFromText(urls.join("\n")), "Could not add the links");
    if (batch) await attempt(api.openWindow("batch", batch.id));
  } else if (!files.length && text.trim()) toast("Nothing to download", { kind: "error", body: "The dropped text contains no http(s), ftp or magnet address." });
}

