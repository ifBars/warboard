import ForestDetection from "./ForestDetection";
import { useState } from "react";
import { defaultApproach, validTreeOutline, type Flight } from "../flight";
import type { Point } from "../model";
export default function FlightPlanningControls({
  flight,
  mapName,
  onChange,
  draft,
  onDraft,
  onTrace,
}: {
  flight: Flight;
  mapName: string;
  onChange: (flight: Flight) => void;
  draft: Point[] | null;
  onDraft: (points: Point[] | null) => void;
  onTrace: () => void;
}) {
  const approach = flight.approach ?? { ...defaultApproach, type: "direct" };
  const [height, setHeight] = useState(25);
  const [kind, setKind] = useState<"trees" | "clearing">("trees");
  const areas = flight.treeAreas ?? [];
  return (
    <>
      <section className="flight-planning-controls">
        <h2>Final approach</h2>
        <label>
          <input
            type="checkbox"
            checked={flight.turns === "smooth"}
            onChange={(e) =>
              onChange({
                ...flight,
                turns: e.target.checked ? "smooth" : undefined,
              })
            }
          />
          Curved transit turns
        </label>
        <label>
          Landing pattern
          <select
            aria-label="Landing pattern"
            value={approach.type}
            onChange={(e) => {
              const type = e.target.value;
              if (type === "direct" || type === "j-hook" || type === "s-turn")
                onChange({ ...flight, approach: { ...approach, type } });
            }}
          >
            <option value="direct">Direct / manual</option>
            <option value="j-hook">J-hook</option>
            <option value="s-turn">S-turn</option>
          </select>
        </label>
        {approach.type !== "direct" && (
          <div className="flight-planning-row">
            <label>
              Turn side
              <select
                aria-label="Approach turn side"
                value={approach.side}
                onChange={(e) =>
                  onChange({
                    ...flight,
                    approach: {
                      ...approach,
                      side: e.target.value === "right" ? "right" : "left",
                    },
                  })
                }
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label>
              Turn size (m)
              <input
                aria-label="Approach turn size"
                type="number"
                min="25"
                max="500"
                step="25"
                value={approach.size}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  if (size >= 25 && size <= 500)
                    onChange({ ...flight, approach: { ...approach, size } });
                }}
              />
            </label>
          </div>
        )}
        {approach.descent === "late" && (
          <p className="flight-small">
            Generated descent is delayed until the end of the turn. Review
            clearance again after changing the pattern.
          </p>
        )}
        <p className="flight-small">
          Shapes the last leg only; earlier waypoints stay fixed. New routes
          default to a J-hook. Existing routes keep their manual path.
        </p>
        <p className="flight-small">
          Pattern preview, not a burn or flight-dynamics simulation. Set the LZ
          waypoint altitude yourself; selecting a pattern does not descend to
          ground.
        </p>
      </section>
      <section className="flight-planning-controls">
        <details open={draft !== null || undefined}>
          <summary>Tree cover ({areas.length} manual)</summary>
          <ForestDetection
            mapName={mapName}
            cover={flight.autoTrees}
            onChange={(autoTrees) => onChange({ ...flight, autoTrees })}
          />
          <label>
            Manual correction
            <select
              aria-label="Outline type"
              value={kind}
              disabled={draft !== null}
              onChange={(e) =>
                setKind(e.target.value === "clearing" ? "clearing" : "trees")
              }
            >
              <option value="trees">Add tree area</option>
              <option value="clearing">Exclude detected area</option>
            </select>
          </label>
          <p className="flight-small">
            Trace visible tree cover in 2D. Heights are assumptions, not
            measured trees. Route warnings include a 10 m horizontal and
            vertical buffer.
          </p>
          {draft === null ? (
            <button
              type="button"
              disabled={areas.length >= 32}
              onClick={onTrace}
            >
              {kind === "clearing" ? "Trace clearing" : "Trace tree area"}
            </button>
          ) : (
            <>
              <p role="status">
                Double-click boundary corners on the map. {draft.length}/64
                points; finish with at least 3 distinct corners.
              </p>
              {kind !== "clearing" && (
                <label>
                  Assumed canopy (m)
                  <input
                    aria-label="New tree canopy height"
                    type="number"
                    min="1"
                    max="100"
                    value={height}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 1 && n <= 100) setHeight(n);
                    }}
                  />
                </label>
              )}
              <div className="flight-planning-row">
                <button
                  type="button"
                  disabled={!validTreeOutline(draft)}
                  onClick={() => {
                    onChange({
                      ...flight,
                      treeAreas: [
                        ...areas,
                        {
                          id: crypto.randomUUID(),
                          kind,
                          name: `${kind === "clearing" ? "Clearing" : "Tree area"} ${areas.length + 1}`,
                          height,
                          points: draft,
                        },
                      ],
                    });
                    onDraft(null);
                  }}
                >
                  Save outline
                </button>
                <button
                  type="button"
                  disabled={!draft.length}
                  onClick={() => onDraft(draft.slice(0, -1))}
                >
                  Undo corner
                </button>
                <button type="button" onClick={() => onDraft(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
          {areas.map((area) => (
            <div className="flight-tree-area" key={area.id}>
              <input
                aria-label="Tree area name"
                maxLength={80}
                value={area.name}
                onChange={(e) =>
                  onChange({
                    ...flight,
                    treeAreas: areas.map((a) =>
                      a.id === area.id ? { ...a, name: e.target.value } : a,
                    ),
                  })
                }
              />
              {area.kind !== "clearing" && (
                <label>
                  Canopy (m)
                  <input
                    aria-label={`${area.name} canopy height`}

                    type="number"
                    min="1"
                    max="100"
                    value={area.height}
                    onChange={(e) => {
                      const height = Number(e.target.value);
                      if (height >= 1 && height <= 100)
                        onChange({
                          ...flight,
                          treeAreas: areas.map((a) =>
                            a.id === area.id ? { ...a, height } : a,
                          ),
                        });
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...flight,
                    treeAreas: areas.filter((a) => a.id !== area.id),
                  })
                }
              >
                Remove {area.name}
              </button>
            </div>
          ))}
        </details>
      </section>
    </>
  );
}
