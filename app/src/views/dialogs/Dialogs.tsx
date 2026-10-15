import { useEffect, useState } from "react";
import { Checkbox, Field, RateField, Segmented, Select, Stepper, TextArea, TextField } from "../../components/Controls";
import { Modal } from "../../components/Modal";
import { FileTile } from "../../components/Visuals";
import { Icon } from "../../design/icons";
import { actions } from "../../lib/actions";
import { api, type ItemPatch } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { categoryIcon } from "../../lib/present";
import { useApp } from "../../lib/store";
import type { Category } from "../../lib/types";
import { attempt, toast, useUi } from "../../lib/ui";
import { pickFolder } from "../../lib/win";

/** Renders whichever small in-window dialog is open. */
export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  const close = useUi((s) => s.closeDialog);
  return (
    <>
      <CategoryDialog open={dialog?.kind === "category"} category={dialog?.kind === "category" ? dialog.category : undefined} onClose={close} />
      <PropertiesDialog id={dialog?.kind === "properties" ? dialog.id : null} onClose={close} />
      <DeleteDialog state={dialog?.kind === "delete" ? dialog : null} onClose={close} />
      <BatchDialog open={dialog?.kind === "batch"} onClose={close} />
      <SpeedLimitDialog ids={dialog?.kind === "speedLimit" ? dialog.ids : null} onClose={close} />
      <RefreshUrlDialog id={dialog?.kind === "refreshUrl" ? dialog.id : null} onClose={close} />
    </>
  );
}

async function browse(current: string, set: (v: string) => void) {
  const p = await pickFolder(current || undefined);
  if (p) set(p);
}

// ---------------------------------------------------------------------------------------

function CategoryDialog({ open, category, onClose }: { open: boolean; category?: Category; onClose: () => void }) {
  const [name, setName] = useState("");
  const [exts, setExts] = useState("");
  const [dir, setDir] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setExts(category?.extensions.join(" ") ?? "");
    setDir(category?.saveDir ?? "");
  }, [open, category]);
  const save = async () => {
    if (!name.trim()) return;
    const cats = useApp.getState().categories;
    const c: Category = {
      id: category?.id ?? (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || `cat-${Date.now()}`),
      name: name.trim(),
      icon: category?.icon ?? "custom-folder",
      extensions: exts.split(/[\s,;]+/).map((e) => e.replace(/^\./, "").toLowerCase()).filter(Boolean),
      saveDir: dir.trim() || null,
      builtin: category?.builtin ?? false,
      position: category?.position ?? cats.length,
    };
    const res = await attempt(api.upsertCategory(c), "Could not save the category");
    if (res) {
      useApp.setState({ categories: res });
      onClose();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      icon={<Icon name="custom-folder" size={18} className="text-accent" />}
      footer={
        <>
          {category && !category.builtin && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={async () => {
                const res = await attempt(api.deleteCategory(category.id), "Could not delete the category");
                if (res) {
                  useApp.setState({ categories: res });
                  onClose();
                }
              }}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!name.trim()} onClick={save}>
            {category ? "Save" : "Create category"}
          </button>
        </>
      }
    >
      <Field label="Name">
        <TextField value={name} onChange={setName} label="Category name" placeholder="e.g. Fonts" autoFocus onEnter={save} />
      </Field>
      <Field label="File extensions" hint="Separated by spaces. New downloads with these extensions go to this category.">
        <TextField value={exts} onChange={setExts} label="Extensions" placeholder="ttf otf woff2" mono />
      </Field>
      <Field label="Save folder" hint="Leave empty to use the default download folder.">
        <div className="withbtn">
          <TextField value={dir} onChange={setDir} icon="folder" label="Save folder" placeholder="Default folder" />
          <button type="button" className="btn" onClick={() => void browse(dir, setDir)}>
            Browse…
          </button>
        </div>
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------

function PropertiesDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const item = useApp((s) => (id ? s.items[id] : undefined));
  const categories = useApp((s) => s.categories);
  const maxConn = useApp((s) => s.settings?.downloads.maxConnections ?? 32);
  const [f, setF] = useState<Required<Pick<ItemPatch, "fileName" | "saveDir" | "description" | "category" | "connections" | "url">> & { checksum: string; username: string; password: string }>({
    fileName: "",
    saveDir: "",
    description: "",
    category: "",
    connections: 8,
    url: "",
    checksum: "",
    username: "",
    password: "",
  });
  useEffect(() => {
    if (item)
      setF({ fileName: item.fileName, saveDir: item.saveDir, description: item.description, category: item.category, connections: item.connections, url: item.url, checksum: item.checksum ?? "", username: "", password: "" });
    // reset the form only when another item is opened
  }, [id]);
  if (!item) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));
  const save = async () => {
    const patch: ItemPatch = {};
    if (f.fileName !== item.fileName) patch.fileName = f.fileName;
    if (f.saveDir !== item.saveDir) patch.saveDir = f.saveDir;
    if (f.description !== item.description) patch.description = f.description;
    if (f.category !== item.category) patch.category = f.category;
    if (f.connections !== item.connections) patch.connections = f.connections;
    if (f.url !== item.url) patch.url = f.url;
    if (f.checksum !== (item.checksum ?? "")) patch.checksum = f.checksum || null;
    if (f.username) {
      patch.username = f.username;
      patch.password = f.password;
    }
    if (Object.keys(patch).length) {
      const r = await attempt(api.updateItem(item.id, patch), "Could not save the changes");
      if (!r) return;
    }
    onClose();
  };
  return (
    <Modal
      open={!!id}
      onClose={onClose}
      width={560}
      title="Properties"
      icon={<FileTile item={item} size={24} thumbWidth={36} />}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => actions.reveal(item.id)}>
            <Icon name="folder-open" size={15} /> Show in folder
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <Field label="File name">
        <TextField value={f.fileName} onChange={(v) => set("fileName", v)} label="File name" />
      </Field>
      <Field label="Address">
        <TextField value={f.url} onChange={(v) => set("url", v)} label="Address" mono icon="link" />
      </Field>
      <Field label="Save to">
        <div className="withbtn">
          <TextField value={f.saveDir} onChange={(v) => set("saveDir", v)} icon="folder" label="Save folder" />
          <button type="button" className="btn" onClick={() => void browse(f.saveDir, (v) => set("saveDir", v))}>
            Browse…
          </button>
        </div>
      </Field>
      <div className="row2">
        <Field label="Category">
          <Select value={f.category} label="Category" onChange={(v) => set("category", v)} options={categories.map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c) }))} />
        </Field>
        <Field label="Connections">
          <Stepper value={f.connections} min={1} max={maxConn} label="connections" onChange={(v) => set("connections", v)} />
        </Field>
      </div>
      <Field label="Checksum" hint="md5:…, sha1:… or sha256:… — verified when the download finishes.">
        <TextField value={f.checksum} onChange={(v) => set("checksum", v)} label="Checksum" mono placeholder="sha256:…" />
      </Field>
      <div className="row2">
        <Field label="User name">
          <TextField value={f.username} onChange={(v) => set("username", v)} label="User name" icon="user" placeholder="Unchanged" />
        </Field>
        <Field label="Password">
          <TextField value={f.password} onChange={(v) => set("password", v)} label="Password" type="password" icon="key" placeholder="Unchanged" />
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={f.description} onChange={(v) => set("description", v)} label="Description" placeholder="Optional note" />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------

function DeleteDialog({ state, onClose }: { state: { ids: string[]; trash: boolean; withFiles?: boolean } | null; onClose: () => void }) {
  const useTrash = useApp((s) => s.settings?.general.useTrash ?? true);
  const first = useApp((s) => (state ? s.items[state.ids[0]] : undefined));
  const [files, setFiles] = useState(false);
  useEffect(() => setFiles(!!state?.withFiles), [state]);
  const n = state?.ids.length ?? 0;
  const permanent = !!state?.trash || !useTrash;
  const what = n === 1 ? `“${first?.fileName ?? "this download"}”` : `${n} downloads`;
  const run = async () => {
    if (!state) return;
    onClose();
    await actions.delete(state.ids, files, permanent);
  };
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      width={460}
      title={permanent ? "Delete permanently?" : "Move to trash?"}
      icon={<Icon name="delete" size={18} className="text-danger" />}
      initialFocus="[data-autofocus]"
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger-solid" data-autofocus onClick={run}>
            <Icon name="delete" size={15} />
            {files ? "Delete with files" : permanent ? "Delete" : "Move to trash"}
          </button>
        </>
      }
    >
      <p className="dialog-text">
        {permanent ? `${what} will be removed from the list.` : `${what} will move to the trash. You can restore it from there.`}
      </p>
      <Checkbox checked={files} onChange={setFiles}>
        Also delete the downloaded files from disk
      </Checkbox>
      {!state?.trash && (
        <p className="field__hint">
          Turn confirmation off in Settings → General → <i>Confirm before deleting</i>.
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------

function BatchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"pattern" | "text">("pattern");
  const [pattern, setPattern] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPattern("https://example.com/files/photo-[001-120].jpg");
      setText("");
    }
  }, [open]);
  const go = async () => {
    setBusy(true);
    const b = await attempt(mode === "pattern" ? api.batchFromPattern(pattern) : api.batchFromText(text), "Could not build the list");
    setBusy(false);
    if (b) {
      onClose();
      await attempt(api.openWindow("batch", b.id), "Could not open the link list");
    }
  };
  const preview = mode === "pattern" ? expandPreview(pattern) : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={580}
      title="Batch download"
      icon={<Icon name="batch" size={18} className="text-accent" />}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || (mode === "pattern" ? !pattern.trim() : !text.trim())} onClick={go}>
            Continue
          </button>
        </>
      }
    >
      <Segmented
        label="Batch source"
        value={mode}
        onChange={setMode}
        options={[
          { value: "pattern", label: "Address pattern" },
          { value: "text", label: "Paste a list" },
        ]}
      />
      {mode === "pattern" ? (
        <>
          <Field label="Pattern" hint={<>Use <code>[001-120]</code> for numbers (zero-padded), <code>[a-z]</code> for letters.</>}>
            <TextField value={pattern} onChange={setPattern} label="Address pattern" mono icon="link" onEnter={go} />
          </Field>
          {preview && (
            <div className="batch-preview t-mono">
              <span>{preview.first}</span>
              <span className="text-tertiary">… {preview.count} files …</span>
              <span>{preview.last}</span>
            </div>
          )}
        </>
      ) : (
        <Field label="Addresses" hint="Any text — every http(s), ftp and magnet address found is added.">
          <TextArea value={text} onChange={setText} label="Addresses" rows={7} placeholder="Paste links, one per line" />
        </Field>
      )}
    </Modal>
  );
}

/** Client-side preview of the first range in a pattern (the core does the real expansion). */
export function expandPreview(pattern: string): { first: string; last: string; count: number } | null {
  const m = pattern.match(/\[(\d+)-(\d+)\]|\[([a-z])-([a-z])\]/i);
  if (!m) return null;
  if (m[1] !== undefined) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const pad = m[1].length;
    const fmt = (n: number) => String(n).padStart(pad, "0");
    return { first: pattern.replace(m[0], fmt(Math.min(a, b))), last: pattern.replace(m[0], fmt(Math.max(a, b))), count: Math.abs(b - a) + 1 };
  }
  const a = m[3].charCodeAt(0);
  const b = m[4].charCodeAt(0);
  return { first: pattern.replace(m[0], String.fromCharCode(Math.min(a, b))), last: pattern.replace(m[0], String.fromCharCode(Math.max(a, b))), count: Math.abs(b - a) + 1 };
}

// ---------------------------------------------------------------------------------------

function SpeedLimitDialog({ ids, onClose }: { ids: string[] | null; onClose: () => void }) {
  const current = useApp((s) => (ids?.length ? s.items[ids[0]]?.speedLimit ?? 0 : 0));
  const [bps, setBps] = useState(0);
  useEffect(() => setBps(current), [current, ids]);
  const save = async () => {
    if (!ids) return;
    await Promise.all(ids.map((id) => attempt(api.updateItem(id, { speedLimit: bps }), "Could not set the limit")));
    toast(bps ? `Limited to ${formatBytes(bps)}/s` : "Speed limit removed", { ms: 2000 });
    onClose();
  };
  return (
    <Modal
      open={!!ids}
      onClose={onClose}
      width={420}
      title="Speed limit"
      icon={<Icon name="speed-limiter" size={18} className="text-accent" />}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => setBps(0)}>
            No limit
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Apply
          </button>
        </>
      }
    >
      <p className="dialog-text">{ids && ids.length > 1 ? `Applies to ${ids.length} downloads.` : "Applies to this download only, on top of the global limiter."}</p>
      <Field label="Maximum speed" hint="e.g. 500k, 2M, 1.5 MB/s. Empty = unlimited.">
        <RateField value={bps} onCommit={setBps} label="Maximum speed" width={200} />
      </Field>
      <div className="chips">
        {[256 * 1024, 1024 ** 2, 5 * 1024 ** 2, 10 * 1024 ** 2].map((v) => (
          <button key={v} type="button" className={`chip${bps === v ? " on" : ""}`} onClick={() => setBps(v)}>
            {formatBytes(v, 0)}/s
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------

function RefreshUrlDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const item = useApp((s) => (id ? s.items[id] : undefined));
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(""), [id]);
  const save = async () => {
    if (!item || !url.trim()) return;
    const r = await attempt(api.updateItem(item.id, { url: url.trim() }), "The new address was rejected");
    if (r) {
      toast("Address refreshed", { kind: "success", body: "The download resumes from where it stopped." });
      actions.resume([item.id]);
      onClose();
    }
  };
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      width={560}
      title="Refresh download address"
      icon={<Icon name="refresh-url" size={18} className="text-accent" />}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!url.trim()} onClick={save}>
            Use new address
          </button>
        </>
      }
    >
      <p className="dialog-text">
        Expired links (403 / 410) can be replaced without losing progress. Open the original page again, copy the fresh download link and paste it here — Prism checks that it is the same file.
      </p>
      <Field label="Current address">
        <div className="input input--readonly">
          <Icon name="link" size={15} />
          <span className="input__value t-mono">{item?.url}</span>
        </div>
      </Field>
      <Field label="New address">
        <TextField value={url} onChange={setUrl} label="New address" mono icon="link" placeholder="https://…" autoFocus onEnter={save} />
      </Field>
    </Modal>
  );
}
