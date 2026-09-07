import { X } from "lucide-react";
import { useModal } from "../useModal";

export default function HelpDialog({
  shortcuts,
  onClose,
}: {
  shortcuts: readonly { label: string; key: string }[];
  onClose: () => void;
}) {
  const modal = useModal();
  return (
    <dialog
      className="help"
      aria-labelledby="help-title"
      ref={modal}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="section-heading">
        <h2 id="help-title">Drawing & navigation</h2>
        <button
          type="button"
          autoFocus
          data-autofocus
          aria-label="Close help"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p>
        Choose Bakurani or Ozeti, or import your own map screenshot. Draw
        directly on the canvas, then export your plan.
      </p>
      <dl>
        {shortcuts.map((t) => (
          <div key={t.key}>
            <dt>{t.label}</dt>
            <dd>
              <kbd>{t.key}</kbd>
            </dd>
          </div>
        ))}
        <div>
          <dt>Undo / Redo</dt>
          <dd>Ctrl + Z / Ctrl + Shift + Z</dd>
        </div>
        <div>
          <dt>Fit map</dt>
          <dd>
            <kbd>0</kbd>
          </dd>
        </div>
        <div>
          <dt>Zoom in / out</dt>
          <dd>+ / −</dd>
        </div>
        <div>
          <dt>Board / Fire / Layers / Flight / Guide</dt>
          <dd>1 / 2 / 3 / 4 / 5</dd>
        </div>
        <div>
          <dt>Delete selected</dt>
          <dd>Delete</dd>
        </div>
      </dl>
      <p>
        <a href="#/guide" onClick={onClose}>
          Open field guide →
        </a>
      </p>
      <p>
        Drawings stay aligned as you pan and zoom. Select an annotation to move
        it or change its style. Edit notes in the side panel. Scroll to zoom, or
        right-drag (or hold Alt and drag) to pan. On touch screens, use two
        fingers to pan and pinch to zoom.
      </p>
      <p>
        Work saves in this browser on this device. Export an editable plan for a
        backup or to use another computer. Clearing browser data removes local
        plans.
      </p>
    </dialog>
  );
}
