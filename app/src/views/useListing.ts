import { useShallow } from "zustand/react/shallow";
import { matchesFilter } from "../lib/present";
import { type AppState, useApp, visibleItems } from "../lib/store";
import { type StatusFilter, useUi } from "../lib/ui";

/** Ordered ids for the sidebar view + title-row status filter + search. */
export function listIds(s: AppState, filter: StatusFilter): string[] {
  const list = visibleItems(s);
  return (filter === "all" ? list : list.filter((i) => matchesFilter(s.progress[i.id]?.status ?? i.status, filter))).map((i) => i.id);
}

/** Same as listIds, re-rendering only when the ordered list actually changes. */
export function useVisibleIds(): string[] {
  const filter = useUi((s) => s.filter);
  return useApp(useShallow((s) => listIds(s, filter)));
}

/** Title for the current sidebar view. */
export function useViewTitle(): string {
  return useApp((s) => {
    const v = s.view;
    switch (v.kind) {
      case "all":
        return "All downloads";
      case "trash":
        return "Trash";
      case "status":
        return { unfinished: "Unfinished", finished: "Finished", active: "Active", failed: "Failed" }[v.id];
      case "category":
        return s.categories.find((c) => c.id === v.id)?.name ?? "Category";
      case "queue":
        return s.queues.find((q) => q.id === v.id)?.name ?? "Queue";
      case "grabber":
        return s.grabberProjects.find((g) => g.id === v.id)?.name ?? "Grabber project";
    }
  });
}
