import { useEffect, useMemo, useState } from "react";
import { Checkbox, TextField } from "../components/Controls";
import { WindowFrame } from "../components/WindowFrame";
import { Icon } from "../design/icons";
import { api, type TorrentMeta, type TorrentSource } from "../lib/api";
import { formatBytes } from "../lib/format";
import { t } from "../lib/i18n";
import { fileVisual } from "../lib/present";
import { useApp } from "../lib/store";
import { buildTree, nodeState, type TreeNode } from "../lib/tree";
import type { StartMode } from "../lib/types";
import { attempt } from "../lib/ui";
import { pickFolder, win } from "../lib/win";

export default function TorrentWindow({ source }: { source: string }) {
  const [src, setSrc] = useState<TorrentSource | null>(null);
  const [meta, setMeta] = useState<TorrentMeta | null>(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dir, setDir] = useState(useApp.getState().settings?.downloads.defaultDir ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s: TorrentSource = /^(magnet:|https?:)/i.test(source) ? { type: "url", value: source } : await api.readTorrentFile(source);
        setSrc(s);
        const m = await api.inspectTorrent(s);
        setMeta(m);
        setSel(new Set(m.files.map((f) => f.index)));
        setOpen(new Set(buildTree(m.files).children.filter((c) => c.children.length).slice(0, 3).map((c) => c.path)));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [source]);

  const tree = useMemo(() => (meta ? buildTree(meta.files) : null), [meta]);
  const size = meta?.files.filter((f) => sel.has(f.index)).reduce((s, f) => s + f.size, 0) ?? 0;

  const toggle = (node: TreeNode) => {
    const n = new Set(sel);
    const st = nodeState(node, sel);
    node.files.forEach((i) => (st === "all" ? n.delete(i) : n.add(i)));
    setSel(n);
  };

  const add = async (mode: StartMode) => {
    if (!src || !meta) return;
    setBusy(true);
    const all = sel.size === meta.files.length;
    const item = await attempt(api.addTorrent({ source: src, name: meta.name, size, onlyFiles: all ? null : [...sel].sort((a, b) => a - b), saveDir: dir || undefined, mode }), t("Could not add the torrent"));
    setBusy(false);
    if (item) void win.close();
  };

  const row = (node: TreeNode, depth: number): React.ReactNode => {
    const folder = node.children.length > 0;
    const isOpen = open.has(node.path);
    const st = nodeState(node, sel);
    return (
      <div key={node.path}>
        <div className="trow" style={{ paddingLeft: 10 + depth * 18 }}>
          {folder ? (
            <button
              type="button"
              className="trow__twist"
              aria-label={isOpen ? t("Collapse") : t("Expand")}
              aria-expanded={isOpen}
              onClick={() => {
                const n = new Set(open);
                if (isOpen) n.delete(node.path);
                else n.add(node.path);
                setOpen(n);
              }}
            >
              <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={13} strokeWidth={2.2} />
            </button>
          ) : (
            <span className="trow__twist" />
          )}
          <Checkbox checked={st === "all"} indeterminate={st === "some"} label={t("Include {name}", { name: node.name })} onChange={() => toggle(node)} />
          <Icon name={folder ? "folder" : fileVisual({ fileName: node.name, kind: "http", category: "" }).icon} size={15} className="text-tertiary" />
          <span className="ellipsis">{node.name}</span>
          <span className="tnum text-tertiary">{formatBytes(node.size)}</span>
        </div>
        {folder && isOpen && node.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <WindowFrame kind="torrent" title={t("Add torrent")} icon={<Icon name="magnet" size={17} className="text-accent" />} className="torrent">
      <div className="wbody">
        <div className="filecard">
          <span className="file-tile" style={{ ["--tint" as string]: "var(--type-archive)", width: 44, height: 44 }}>
            <Icon name="torrent" size={24} />
          </span>
          <div className="grow">
            <b className="fname-static">{meta?.name ?? (error ? t("Couldn’t read the torrent") : t("Reading metadata…"))}</b>
            <div className="tags">
              {meta ? (
                <>
                  <span className="badge">{t("{count} files", { count: meta.files.length })}</span>
                  <span className="badge t-mono" data-tip={t("Info hash")}>
                    {meta.infoHash.slice(0, 12)}…
                  </span>
                </>
              ) : error ? (
                <span className="badge badge--danger">{error}</span>
              ) : (
                <span className="badge badge--accent">
                  <Icon name="retry" size={11} strokeWidth={2.2} className="anim-spin" /> {t("Fetching from peers…")}
                </span>
              )}
            </div>
          </div>
          <div className="big tnum">
            {formatBytes(size || meta?.totalSize)}
            <small>{meta && sel.size < meta.files.length ? t("of {size}", { size: formatBytes(meta.totalSize) }) : ""}</small>
          </div>
        </div>
        <div className="tree" role="tree" aria-label={t("Files")}>
          {tree?.children.map((c) => row(c, 0))}
        </div>
        <div className="field">
          <span className="field__label">{t("Save to")}</span>
          <div className="withbtn">
            <TextField value={dir} onChange={setDir} icon="folder" label={t("Save folder")} />
            <button type="button" className="btn" onClick={async () => setDir((await pickFolder(dir)) ?? dir)}>
              {t("Browse…")}
            </button>
          </div>
        </div>
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn btn--ghost btn--sm" disabled={!meta} onClick={() => meta && setSel(new Set(meta.files.map((f) => f.index)))}>
          {t("Select all")}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={!meta} onClick={() => setSel(new Set())}>
          {t("None")}
        </button>
        <span className="spacer" />
        <button type="button" className="btn" disabled={!meta || !sel.size || busy} onClick={() => add({ type: "later" })}>
          {t("Later")}
        </button>
        <button type="button" className="btn btn--primary" disabled={!meta || !sel.size || busy} onClick={() => add({ type: "now" })}>
          <Icon name="download" size={15} /> {t("Download")}
        </button>
      </footer>
    </WindowFrame>
  );
}
