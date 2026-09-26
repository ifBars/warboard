import { Share2, X } from "lucide-react";
import { dismissShare, useShareInbox, type SharedPlan } from "../share";

export default function ShareInbox({
  busy,
  onOpen,
}: {
  busy: boolean;
  onOpen: (shared: SharedPlan, mode: "replace" | "merge") => Promise<void>;
}) {
  const inbox = useShareInbox();
  if (inbox.state === "idle") return null;
  if (inbox.state !== "ready")
    return (
      <div
        className="share-inbox"
        role={inbox.state === "error" ? "alert" : "status"}
      >
        <Share2 size={18} />
        <span>
          {inbox.state === "loading" ? "Reading share link…" : inbox.message}
        </span>
        {inbox.state === "error" && (
          <button type="button" aria-label="Dismiss" onClick={dismissShare}>
            <X size={16} />
          </button>
        )}
      </div>
    );
  const { shared } = inbox;
  const markers = shared.marks.filter((m) => m.type === "marker").length;
  const targets =
    (shared.mission?.target ? 1 : 0) + (shared.mission?.targets.length ?? 0);
  const open = (mode: "replace" | "merge") => {
    dismissShare();
    void onOpen(shared, mode);
  };
  return (
    <section className="share-inbox" aria-labelledby="share-title">
      <Share2 size={18} />
      <div>
        <h2 id="share-title">Shared plan: {shared.name || "Untitled"}</h2>
        <p>
          {shared.map} · {shared.marks.length} annotations
          {markers ? ` (${markers} markers)` : ""}
          {targets ? ` · ${targets} target${targets === 1 ? "" : "s"}` : ""}
          {shared.operations ? " · briefing" : ""}
          {shared.base ? " · base layout" : ""}
        </p>
        <div className="share-actions">
          <button type="button" disabled={busy} onClick={() => open("merge")}>
            Add to my {shared.map} plan
          </button>
          <button type="button" disabled={busy} onClick={() => open("replace")}>
            Replace my {shared.map} plan
          </button>
          <button type="button" className="text-button" onClick={dismissShare}>
            Ignore
          </button>
        </div>
        <small>
          Either choice can be undone. Links only carry overlays, never your map
          image.
        </small>
      </div>
    </section>
  );
}
