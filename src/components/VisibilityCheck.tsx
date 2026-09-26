import { useState } from "react";
import { Eye, Radar } from "lucide-react";
import type { Mark, Plan } from "../model";
import {
  defaultVisibility,
  geometryKey,
  runCoverage,
  runSight,
  targetPresets,
  type Analysis,
  type VisibilitySettings,
} from "../visibilityAnalysis";
import SightProfile from "./SightProfile";

export default function VisibilityCheck({
  plan,
  mark,
  analysis,
  onResult,
}: {
  plan: Plan;
  mark: Mark;
  analysis: Analysis | null;
  onResult: (analysis: Analysis | null) => void;
}) {
  const [settings, setSettings] = useState<VisibilitySettings>(
    analysis?.settings ?? defaultVisibility,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sight = mark.type === "ruler";
  const current =
    analysis &&
    analysis.markId === mark.id &&
    analysis.key === geometryKey(mark) &&
    analysis.kind === (sight ? "sight" : "coverage")
      ? analysis
      : null;
  const stale = !!analysis && analysis.markId === mark.id && !current;
  const preset = targetPresets.find((p) => p.height === settings.targetHeight);
  function run() {
    setBusy(true);
    setError("");
    (sight ? runSight : runCoverage)(plan, mark, settings)
      .then(onResult)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Check unavailable."),
      )
      .finally(() => setBusy(false));
  }
  const number = (
    key: "observerHeight" | "targetHeight",
    label: string,
    max: number,
  ) => (
    <label className="visibility-field">
      {label}
      <span>
        <input
          type="number"
          min="0"
          max={max}
          step="0.5"
          value={settings[key]}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isFinite(value))
              setSettings({
                ...settings,
                [key]: Math.max(0, Math.min(max, value)),
              });
          }}
        />
        m
      </span>
    </label>
  );
  return (
    <section className="visibility-check">
      <h3>
        {sight ? <Eye size={15} /> : <Radar size={15} />}
        {sight ? "Line of sight" : "Coverage from centre"}
      </h3>
      <div className="visibility-grid">
        {number("observerHeight", sight ? "Observer above ground" : "Observer / sensor above ground", 300)}
        {number("targetHeight", "Target above ground", 500)}
        <label className="visibility-field">
          Target type
          <select
            value={preset?.label ?? "custom"}
            onChange={(e) => {
              const next = targetPresets.find((p) => p.label === e.target.value);
              if (next) setSettings({ ...settings, targetHeight: next.height });
            }}
          >
            {targetPresets.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} · {p.height} m
              </option>
            ))}
            {!preset && <option value="custom">Custom height</option>}
          </select>
        </label>
        <label className="visibility-toggle">
          <input
            type="checkbox"
            checked={settings.trees}
            onChange={(e) => setSettings({ ...settings, trees: e.target.checked })}
          />
          {sight ? "Trees block sight" : "Show tree cover separately"}
        </label>
      </div>
      <button type="button" disabled={busy} onClick={run}>
        {busy
          ? "Checking…"
          : current || stale
            ? "Check again"
            : sight
              ? "Check line of sight"
              : "Check coverage"}
      </button>
      {error && (
        <p className="field-error" role="status">
          {error}
        </p>
      )}
      {stale && <p role="status">The shape moved. Check again to update.</p>}
      {current?.kind === "sight" && (
        <>
          <p
            role="status"
            className={`visibility-result ${current.result.clear ? "clear" : "blocked"}`}
          >
            {current.result.clear
              ? `Clear · lowest gap ${current.result.margin.toFixed(1)} m`
              : `Blocked at ${Math.round(current.result.blocker!.distance)} m by ${current.result.blocker!.kind === "trees" ? "tree canopy" : "terrain or a structure"}`}
          </p>
          <SightProfile result={current.result} />
        </>
      )}
      {current?.kind === "coverage" && (
        <p role="status" className="visibility-result">
          {Math.round(current.visibleShare * 100)}% clear
          {current.treeShare > 0.005
            ? `, ${Math.round(current.treeShare * 100)}% only through trees,`
            : ""}{" "}
          within {(current.radius / 1000).toFixed(2)} km at{" "}
          {current.settings.targetHeight} m above ground.
          <span className="visibility-legend">
            <i className="seen" /> clear
            {current.settings.trees && (
              <>
                <i className="screened" /> tree cover
              </>
            )}
            <i className="hidden" /> blocked
          </span>
        </p>
      )}
      {current && (
        <button type="button" className="text-button" onClick={() => onResult(null)}>
          Clear result
        </button>
      )}
      <small>
        Estimate from the 8 m structure surface and conservative tree envelopes.
        Trees within 25 m of a position count as its own cover.
        {sight ? "" : " Raise the sensor height for rooftop, hill or vehicle positions."}{" "}
        Windows, fences,
        destructible objects and player bases are not modelled.
      </small>
    </section>
  );
}
