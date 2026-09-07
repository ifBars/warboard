import { useCallback, useRef, useState } from "react";
import {
  isForestCover,
  type ForestCover,
  type ForestSensitivity,
} from "../forest";
export default function ForestDetection({
  mapName,
  cover,
  onChange,
}: {
  mapName: string;
  cover: ForestCover | undefined;
  onChange: (cover: ForestCover | undefined) => void;
}) {
  const [sensitivity, setSensitivity] = useState<ForestSensitivity>(
      cover?.sensitivity ?? "balanced",
    ),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState("");
  const worker = useRef<Worker | null>(null),
    deliver = useRef(onChange);
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);
  const sync = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) deliver.current = onChange;
    },
    [onChange],
  );
  function detect() {
    if (mapName !== "Bakurani" && mapName !== "Ozeti") return;
    worker.current?.terminate();
    setProgress(0);
    setError("");
    try {
      const task = new Worker(new URL("../forest.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = task;
      task.onmessage = (event: MessageEvent<unknown>) => {
        if (worker.current !== task) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;
        if ("progress" in data && typeof data.progress === "number")
          setProgress(data.progress);
        if ("result" in data) {
          if (isForestCover(data.result)) {
            deliver.current({ ...data.result, height: cover?.height ?? 25 });
          } else setError("Detection returned invalid data.");
          task.terminate();
          worker.current = null;
          setProgress(null);
        }
        if ("error" in data && typeof data.error === "string") {
          setError(data.error);
          task.terminate();
          worker.current = null;
          setProgress(null);
        }
      };
      task.onerror = () => {
        if (worker.current !== task) return;
        setError("Tree detection could not run. Retry or use manual outlines.");
        task.terminate();
        worker.current = null;
        setProgress(null);
      };
      task.postMessage({ map: mapName, sensitivity });
    } catch {
      setProgress(null);
      setError("This browser cannot start background image analysis.");
    }
  }
  return (
    <div ref={attach} className="forest-detection">
      <span hidden ref={sync} />
      <h3>Automatic tree cover</h3>
      <label>
        Detection sensitivity
        <select
          aria-label="Tree detection sensitivity"
          value={sensitivity}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "dense" || v === "balanced" || v === "broad")
              setSensitivity(v);
          }}
          disabled={progress !== null}
        >
          <option value="dense">Dense cover only</option>
          <option value="balanced">Balanced</option>
          <option value="broad">Include sparse cover</option>
        </select>
      </label>
      <div className="flight-planning-row">
        <button type="button" onClick={detect} disabled={progress !== null}>
          {cover ? "Re-detect whole map" : "Detect trees on whole map"}
        </button>
        {progress !== null && (
          <button
            type="button"
            onClick={() => {
              worker.current?.terminate();
              worker.current = null;
              setProgress(null);
            }}
          >
            Cancel detection
          </button>
        )}
      </div>
      {progress !== null && (
        <p role="status">Analyzing colored imagery… {progress}%</p>
      )}
      {error && <p role="alert">{error}</p>}
      {cover && !cover.detectorRevision && (
        <p className="flight-small">
          Re-detect to refine tree edges and preserve road gaps. Manual
          corrections are kept.
        </p>
      )}
      {cover && (
        <fieldset disabled={progress !== null}>
          <p role="status">
            {cover.patches.toLocaleString()} patches ·{" "}
            {((cover.cells / (cover.size * cover.size)) * 100).toFixed(1)}% of
            map · {cover.sensitivity}
          </p>
          <label className="forest-toggle">
            <input
              type="checkbox"
              checked={cover.enabled}
              onChange={(e) =>
                onChange({ ...cover, enabled: e.target.checked })
              }
            />
            Use detected cover for clearance checks
          </label>
          <label>
            Assumed detected canopy (m)
            <input
              aria-label="Detected canopy height"
              type="number"
              min="1"
              max="100"
              value={cover.height}
              onChange={(e) => {
                const height = Number(e.target.value);
                if (height >= 1 && height <= 100)
                  onChange({ ...cover, height });
              }}
            />
          </label>
          <button type="button" onClick={() => onChange(undefined)}>
            Clear detection
          </button>
        </fieldset>
      )}
      <p className="flight-small">
        Local image estimate at roughly 8 m per cell. Road-like strips and open
        ground are excluded where visible. Narrow or hidden roads may be missed.
        Review gaps and false positives; trace a clearing to exclude an area, or
        add missed trees manually. Canopy height is assumed.
      </p>
    </div>
  );
}
