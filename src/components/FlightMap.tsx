import { useCallback, useState } from "react";
import { createFlightScene, type SceneState } from "../flightScene";
import { routeLocations, type TerrainGrid } from "../flight";
import type { Plan } from "../model";
import { mapData, toPixel } from "../cartography";

export default function FlightMap({
  grid,
  map,
  state,
}: {
  grid: TerrainGrid;
  map: Plan["map"];
  state: SceneState;
}) {
  const [engine, setEngine] = useState<ReturnType<
    typeof createFlightScene
  > | null>(null);
  const [error, setError] = useState("");
  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const data = mapData(map);
      if (!data) return;
      try {
        const next = createFlightScene(node, grid, map.image, data);
        setEngine(next);
        return () => next.dispose();
      } catch {
        setError(
          "3D rendering is unavailable in this browser. Use the 2D map below.",
        );
      }
    },
    [grid, map],
  );
  const sync = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) engine?.update(state);
    },
    [engine, state],
  );
  return (
    <div className="flight-map">
      <div className="flight-webgl" ref={mount} />
      <span hidden ref={sync} />
      {error ? (
        <div className="flight-fallback">
          <p role="status">{error}</p>
          <svg
            aria-label="2D flight map"
            viewBox="0 0 4096 4096"
            onDoubleClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect(),
                d = mapData(map);
              if (!d) return;
              state.onAdd({
                x:
                  d.tileBounds.minX +
                  ((e.clientX - r.left) / r.width) *
                    (d.tileBounds.maxX - d.tileBounds.minX),
                y:
                  d.tileBounds.maxY -
                  ((e.clientY - r.top) / r.height) *
                    (d.tileBounds.maxY - d.tileBounds.minY),
              });
            }}
          >
            <image
              href={state.image}
              width="4096"
              height="4096"
              onError={(e) => e.currentTarget.setAttribute("href", map.image)}
            />
            {state.coverVisual && (
              <image href={state.coverVisual.url} width="4096" height="4096" />
            )}
            {state.spawns &&
              mapData(map)?.polygons.map((poly) => (
                <g key={poly.label}>
                  <polygon
                    points={poly.points
                      .map((p) => {
                        const q = toPixel({ x: p.x / 100, y: p.y / 100 }, map)!;
                        return `${q.x},${q.y}`;
                      })
                      .join(" ")}
                    fill={poly.color}
                    fillOpacity=".2"
                    stroke={poly.color}
                    strokeWidth="8"
                  />
                  <text
                    x={
                      toPixel(
                        {
                          x: poly.points[0].x / 100,
                          y: poly.points[0].y / 100,
                        },
                        map,
                      )!.x
                    }
                    y={
                      toPixel(
                        {
                          x: poly.points[0].x / 100,
                          y: poly.points[0].y / 100,
                        },
                        map,
                      )!.y - 20
                    }
                    fill={poly.color}
                    fontSize="60"
                  >
                    {poly.label}
                  </text>
                </g>
              ))}
            {state.towers &&
              mapData(map)
                ?.markers.filter((m) => m.icon === "tower")
                .map((m) => {
                  const p = toPixel({ x: m.x / 100, y: m.y / 100 }, map)!;
                  return (
                    <g key={m.label}>
                      <circle cx={p.x} cy={p.y} r="20" fill="#a6dce5" />
                      <text x={p.x + 25} y={p.y} fill="#a6dce5" fontSize="45">
                        {m.label}
                      </text>
                    </g>
                  );
                })}
            <polyline
              points={routeLocations(
                state.flight.waypoints,
                state.flight.approach,
                state.flight.turns === "smooth",
              )
                .map((p) => {
                  const q = toPixel(p, map)!;
                  return `${q.x},${q.y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#a6dce5"
              strokeWidth="10"
            />
            {(state.treeOutlines ? (state.flight.treeAreas ?? []) : []).map(
              (area) => (
                <polygon
                  key={area.id}
                  points={area.points
                    .map((p) => {
                      const q = toPixel(p, map)!;
                      return `${q.x},${q.y}`;
                    })
                    .join(" ")}
                  fill="#94cf8b"
                  fillOpacity=".15"
                  stroke="#94cf8b"
                  strokeWidth="8"
                />
              ),
            )}
            <polyline
              points={state.treeDraft
                .map((p) => {
                  const q = toPixel(p, map)!;
                  return `${q.x},${q.y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#e8bb48"
              strokeWidth="8"
            />
            {state.flight.waypoints.map((p, i) => {
              const d = mapData(map)!;
              return (
                <circle
                  key={p.id}
                  cx={
                    ((p.x - d.tileBounds.minX) /
                      (d.tileBounds.maxX - d.tileBounds.minX)) *
                    4096
                  }
                  cy={
                    ((d.tileBounds.maxY - p.y) /
                      (d.tileBounds.maxY - d.tileBounds.minY)) *
                    4096
                  }
                  r="35"
                  fill={i === state.selected ? "#e8bb48" : "#a6dce5"}
                />
              );
            })}
          </svg>
        </div>
      ) : null}
      <div className="flight-camera-actions">
        <button type="button" onClick={() => engine?.reset()}>
          Fit terrain
        </button>
        {state.context !== "board" && (
          <button
            type="button"
            disabled={!state.flight.waypoints[state.selected]}
            onClick={() => {
              const p = state.flight.waypoints[state.selected];
              if (p) engine?.focus(p);
            }}
          >
            Focus waypoint
          </button>
        )}
      </div>
      <div className="flight-map-caption">
        {state.mode === "3d"
          ? "Drag to orbit · right-drag to pan"
          : "Drag to pan"}{" "}
        {state.context === "board"
          ? "· scroll to zoom · double-click to mark a FOB candidate"
          : "· scroll to zoom · double-click to add"}
        <br />
        North is map-up in 2D · vertical scale {state.exaggeration}×
      </div>
    </div>
  );
}
