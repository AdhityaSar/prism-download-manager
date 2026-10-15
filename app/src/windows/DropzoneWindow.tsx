import { useEffect, useState } from "react";
import { LogoMark } from "../components/LogoMark";
import { WindowFrame } from "../components/WindowFrame";
import { Icon } from "../design/icons";
import { api } from "../lib/api";
import { attempt } from "../lib/ui";
import { handleDrop } from "../lib/drop";

/** Floating drop target: drag links or .torrent files onto the orb. Double-click opens Prism. */
export default function DropzoneWindow() {
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [flash]);
  return (
    <WindowFrame kind="dropzone" bare className="dropzone-frame">
      <div
        className={`dropzone${over ? " is-over" : ""}${flash ? " is-done" : ""}`}
        data-tauri-drag-region
        role="button"
        tabIndex={0}
        aria-label="Drop links here to download. Double-click to open Prism."
        data-tip="Drop links here · double-click opens Prism"
        onDoubleClick={() => void attempt(api.showMain())}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          await handleDrop(e.dataTransfer);
          setFlash(true);
        }}
      >
        {flash ? <Icon name="check" size={34} strokeWidth={2} className="text-success" /> : <LogoMark size={56} />}
        <button type="button" className="dropzone__close" aria-label="Hide drop zone" onClick={() => void attempt(api.toggleDropzone())}>
          <Icon name="close" size={11} strokeWidth={2} />
        </button>
      </div>
    </WindowFrame>
  );
}
