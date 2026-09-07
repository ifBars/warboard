import { useCallback, useRef, useState, type ReactNode } from "react";
import { Layers, X } from "lucide-react";

export default function MapLayersDropdown({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !node.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <div
      className="map-layers-dropdown"
      ref={attach}
      onBlur={(e) => {
        if (
          e.relatedTarget instanceof Node &&
          !e.currentTarget.contains(e.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Layers size={17} />
      </button>
      {open && (
        <div
          className="map-layers-popover"
          role="region"
          aria-label="Map layers"
        >
          <button
            className="close-layers"
            type="button"
            aria-label="Close map layers"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            <X size={16} />
          </button>
          {children}
        </div>
      )}
    </div>
  );
}
