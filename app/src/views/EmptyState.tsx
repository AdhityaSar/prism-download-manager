import { Icon, type IconName } from "../design/icons";
import { actions } from "../lib/actions";
import { useApp } from "../lib/store";
import { useUi } from "../lib/ui";

/** Friendly empty state for each view (and for searches / filters with no match). */
export function EmptyState() {
  const view = useApp((s) => s.view);
  const search = useApp((s) => s.search.trim());
  const filter = useUi((s) => s.filter);
  const queueName = useApp((s) => (s.view.kind === "queue" ? s.queues.find((q) => q.id === (s.view as { id: string }).id)?.name : undefined));

  let icon: IconName = "download";
  let title = "No downloads yet";
  let text = "Paste a link, drop one here, or let the browser extension hand downloads to Prism.";
  let cta: { label: string; run: () => void } | null = { label: "Add URL", run: actions.openAddUrl };

  if (search) {
    icon = "search";
    title = `No matches for “${search}”`;
    text = "Search looks at file names, addresses and descriptions.";
    cta = { label: "Clear search", run: () => useApp.getState().setSearch("") };
  } else if (filter !== "all") {
    icon = "filter";
    title = "Nothing here with this filter";
    text = "Switch the status filter back to All to see every download in this view.";
    cta = { label: "Show all", run: () => useUi.getState().setFilter("all") };
  } else if (view.kind === "trash") {
    icon = "trash";
    title = "Trash is empty";
    text = "Deleted downloads stay here until you empty the trash, so you can restore them.";
    cta = null;
  } else if (view.kind === "queue") {
    icon = "queue";
    title = `${queueName ?? "This queue"} is empty`;
    text = "Right-click downloads and choose Move to queue, or pick this queue in the Download File dialog.";
    cta = null;
  } else if (view.kind === "status" && view.id === "finished") {
    icon = "finished";
    title = "Nothing finished yet";
    text = "Completed downloads appear here.";
    cta = null;
  } else if (view.kind === "status" && view.id === "unfinished") {
    icon = "finished";
    title = "All caught up";
    text = "Every download has finished.";
    cta = null;
  } else if (view.kind === "category") {
    icon = "custom-folder";
    title = "No downloads in this category";
    text = "Files are sorted into categories by their extension.";
  } else if (view.kind === "grabber") {
    icon = "grabber-project";
    title = "Nothing downloaded from this project";
    text = "Open the project to pick files from the crawl results.";
    cta = { label: "Open project", run: () => useUi.getState().openSheet({ kind: "grabber", projectId: view.id }) };
  }

  return (
    <div className="empty" role="status">
      <span className="empty__icon">
        <Icon name={icon} size={26} strokeWidth={1.5} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {cta && (
        <button type="button" className="btn" onClick={cta.run}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
