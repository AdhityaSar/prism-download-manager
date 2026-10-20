/** "Download complete" sounds to choose from (Settings › Sounds). "classic" is complete.wav;
 *  every other id plays sounds/complete-<id>.wav. */
export const COMPLETE_SOUNDS: { id: string; name: string }[] = [
  { id: "classic", name: "Classic" },
  { id: "prism", name: "Prism" },
  { id: "pop", name: "Pop" },
  { id: "kalimba", name: "Kalimba" },
  { id: "snap", name: "Snap" },
  { id: "cascade", name: "Cascade" },
  { id: "glide", name: "Glide" },
  { id: "harp", name: "Harp" },
  { id: "droplet", name: "Droplet" },
  { id: "music-box", name: "Music box" },
  { id: "sparkle", name: "Sparkle" },
];

/** The file (without .wav) under /sounds that plays for `kind`; an unknown complete sound
 *  falls back to the classic one. */
export function soundFile(kind: string, completeSound?: string): string {
  if (kind === "failed") return "failed";
  if (kind === "queue") return "queue";
  return completeSound && completeSound !== "classic" && COMPLETE_SOUNDS.some((s) => s.id === completeSound) ? `complete-${completeSound}` : "complete";
}
