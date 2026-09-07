import { RadioTower, LocateFixed, Crosshair } from "lucide-react";
import { useState } from "react";
import { coordinateText, parseCoordinates } from "../ballistics";
import { mapData, landmarks } from "../cartography";
import type { Plan, Point } from "../model";
import { type LayerSettings } from "./ReferenceLayer";
export default function MapLayers({
  map,
  layers,
  onChange,
  onFocus,
  onTarget,
}: {
  map: Plan["map"];
  layers: LayerSettings;
  onChange: (s: LayerSettings) => void;
  onFocus: (p: Point) => void;
  onTarget: (p: Point) => void;
}) {
  const [search, setSearch] = useState(""),
    [error, setError] = useState("");
  if (!mapData(map))
    return (
      <section className="map-layers">
        <h2>Uncalibrated image</h2>
        <p>
          Reference layers and game-coordinate lookup are available on the
          bundled Bakurani and Ozeti maps.
        </p>
      </section>
    );
  return (
    <section className="map-layers">
      <div className="section-heading">
        <h2>Reference layers</h2>
        <RadioTower size={15} />
      </div>
      <form
        className="coordinate-search"
        onSubmit={(e) => {
          e.preventDefault();
          const p = parseCoordinates(search);
          if (p) {
            onFocus(p);
            setError("");
          } else setError("Enter coordinates like X 80.25, Y 72.50.");
        }}
      >
        <label htmlFor="coordinate-search">Go to coordinates</label>
        <div>
          <input
            id="coordinate-search"
            value={search}
            maxLength={80}
            placeholder="X 80.25, Y 72.50"
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" aria-label="Find coordinates">
            <LocateFixed size={16} />
          </button>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </form>
      <div className="layer-toggles">
        {(
          [
            { id: "towers", label: "Towers" },
            { id: "spawns", label: "Spawn areas" },
            { id: "vendors", label: "Vendors & spawn boards" },
          ] as const
        ).map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={layers[s.id]}
              onChange={(e) =>
                onChange({ ...layers, [s.id]: e.target.checked })
              }
            />
            {s.label}
          </label>
        ))}
      </div>
      <details>
        <summary>Tower coordinates</summary>
        <ol>
          {landmarks(map)
            .filter((m) => m.kind === "tower")
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true }),
            )
            .map((m) => (
              <li key={m.name}>
                <span>
                  <strong>{m.name}</strong>
                  <small>{coordinateText(m.point)}</small>
                </span>
                <button
                  type="button"
                  aria-label={`Center ${m.name}`}
                  title="Center tower"
                  onClick={() => onFocus(m.point)}
                >
                  <LocateFixed size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Target ${m.name}`}
                  title="Set artillery target"
                  onClick={() => onTarget(m.point)}
                >
                  <Crosshair size={15} />
                </button>
              </li>
            ))}
        </ol>
      </details>
      <p>
        Community reference positions, not live ownership. Verify against this
        match.
      </p>
    </section>
  );
}
