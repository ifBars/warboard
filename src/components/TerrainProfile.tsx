import { useState } from "react";
import { Mountain } from "lucide-react";
import { terrainProfile } from "../terrain";
import type { Point } from "../model";
export default function TerrainProfile({
  map,
  gun,
  target,
  distance,
}: {
  map: string;
  gun: Point;
  target: Point;
  distance: number;
}) {
  const [heights, setHeights] = useState<number[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const min = heights ? Math.min(...heights) - 5 : 0,
    max = heights ? Math.max(...heights) + 5 : 1;
  const path = heights
    ?.map(
      (h, i) =>
        `${i === 0 ? "M" : "L"}${(i / 32) * 270},${100 - ((h - min) / (max - min)) * 80}`,
    )
    .join(" ");
  return (
    <section className="terrain-profile">
      <button
        type="button"
        title="Inspect or hide the terrain elevation profile"
        disabled={busy}
        onClick={() => {
          if (heights) {
            setHeights(null);
            return;
          }
          setBusy(true);
          setError("");
          void terrainProfile(map, gun, target)
            .then(setHeights)
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <Mountain size={16} />
        {busy
          ? "Loading terrain…"
          : heights
            ? "Hide terrain profile"
            : "Inspect terrain height"}
      </button>
      {error && (
        <p className="field-error" role="status">
          {error}
        </p>
      )}
      {heights && (
        <>
          <div className="terrain-summary">
            <span>
              Gun <strong>{heights[0].toFixed(0)} m</strong>
            </span>
            <span>
              Target <strong>{heights[32].toFixed(0)} m</strong>
            </span>
            <span>
              Δ height{" "}
              <strong>
                {heights[32] - heights[0] > 0 ? "+" : ""}
                {(heights[32] - heights[0]).toFixed(0)} m
              </strong>
            </span>
          </div>
          <svg
            viewBox="0 0 270 130"
            role="img"
            aria-label={`Terrain profile: gun ${heights[0].toFixed(0)} meters, target ${heights[32].toFixed(0)} meters. This is ground elevation, not a shell trajectory.`}
          >
            <path
              d={`${path} L270,110 L0,110 Z`}
              fill="#859677"
              fillOpacity=".16"
            />
            <path d={path} stroke="#aabd96" strokeWidth="2" fill="none" />
            <text x="0" y="125" fill="#b9c1b5" fontSize="10">
              Gun · 0 m
            </text>
            <text x="270" y="125" textAnchor="end" fill="#b9c1b5" fontSize="10">
              Target · {Math.round(distance)} m
            </text>
            <text x="0" y="12" fill="#b9c1b5" fontSize="10">
              {max.toFixed(0)} m
            </text>
          </svg>
          <p>
            33 ground samples. Buildings and vehicle pose are excluded. This
            profile is not a shell trajectory or a visibility test. MIL values
            above remain the flat-ground estimate.
          </p>
        </>
      )}
    </section>
  );
}
