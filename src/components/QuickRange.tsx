import { useState } from "react";
import {
  firingSolution,
  formatMil,
  profiles,
  type WeaponId,
} from "../ballistics";

export default function QuickRange({ weapon }: { weapon: WeaponId }) {
  const [range, setRange] = useState("");
  const profile = profiles.find((entry) => entry.id === weapon)!;
  const distance = Number(range);
  const solutions = range.trim() ? firingSolution(weapon, distance) : [];
  return (
    <details className="quick-range">
      <summary>Know the distance? Quick elevation lookup</summary>
      <label htmlFor="quick-range">Horizontal distance to target (m)</label>
      <input
        id="quick-range"
        type="number"
        inputMode="decimal"
        min="0"
        max="20000"
        step="any"
        value={range}
        placeholder="e.g. 500"
        onChange={(e) => setRange(e.target.value)}
      />
      {range.trim() && (
        <div className="quick-range-result" aria-live="polite">
          {solutions.length ? (
            solutions.map((solution) => (
              <p key={solution.arc}>
                <span>
                  {solution.arc === "single"
                    ? "Elevation"
                    : `${solution.arc} arc`}
                </span>
                <strong>{formatMil(solution.mil)} MIL</strong>
              </p>
            ))
          ) : (
            <p className="range-warning">
              No supported solution. {profile.name} table: {profile.min}–
              {profile.max.toLocaleString()} m.
            </p>
          )}
        </div>
      )}
      <small>
        Flat-ground estimate. This lookup does not change your map positions or
        give a compass bearing. Confirm with a ranging shot.
      </small>
    </details>
  );
}
