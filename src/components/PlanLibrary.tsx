import { useState } from "react";
import { FolderOpen, Save, X, Trash2, Download } from "lucide-react";
import {
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot,
  type SavedPlan,
} from "../library";
import { download } from "../storage";
import type { Plan } from "../model";
import { useModal } from "../useModal";

export default function PlanLibrary({
  plan,
  initial,
  onOpen,
  onClose,
}: {
  plan: Plan;
  initial: SavedPlan[];
  onOpen: (p: Plan) => void;
  onClose: () => void;
}) {
  const modal = useModal();
  const [entries, setEntries] = useState(initial),
    [name, setName] = useState(plan.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Local storage is unavailable. Export your current plan to keep a backup.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="library-dialog"
      aria-labelledby="library-title"
      ref={modal}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="section-heading">
        <h2 id="library-title">Your plans</h2>
        <button type="button" aria-label="Close plan library" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <p>
        Keep named snapshots for different strategies. Your current working
        draft continues to save automatically.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => setEntries(await saveSnapshot(plan, name)));
        }}
      >
        <label htmlFor="snapshot-name">Save current board as</label>
        <div>
          <input
            id="snapshot-name"
            autoFocus
            data-autofocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || entries.length >= 30}
          >
            <Save size={16} />
            Save copy
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="library-heading">
        <span>{entries.length}/30 saved locally</span>
        <span>Export JSON for a separate backup</span>
      </div>
      {!entries.length ? (
        <div className="library-empty">
          <FolderOpen size={30} />
          <h3>No saved copies yet</h3>
          <p>
            Save your first strategy above. Existing working drafts are
            unaffected.
          </p>
        </div>
      ) : (
        <ol>
          {entries.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="library-open"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const next = await loadSnapshot(p.id);
                    onOpen(next);
                    onClose();
                  })
                }
              >
                <strong>{p.name}</strong>
                <span>
                  {p.map} · {p.marks} annotations ·{" "}
                  {new Date(p.updated).toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Export ${p.name}`}
                title="Export snapshot"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const snapshot = await loadSnapshot(p.id);
                    download(
                      new Blob([JSON.stringify(snapshot)], {
                        type: "application/json",
                      }),
                      `${snapshot.name}.warboard.json`,
                    );
                  })
                }
              >
                <Download size={17} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${p.name}`}
                title="Delete snapshot"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Delete saved copy “${p.name}”? The current board is unaffected.`,
                    )
                  )
                    void run(async () =>
                      setEntries(await deleteSnapshot(p.id)),
                    );
                }}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </dialog>
  );
}
