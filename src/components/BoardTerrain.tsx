import { assetUrl } from "../assetUrl";
import { mapImage } from "../mapImagery";
import TerrainLoading from "./TerrainLoading";
import { useCallback, useMemo, useState } from "react";
import FlightMap from "./FlightMap";
import { emptyFlight, isTerrainGrid, type TerrainGrid } from "../flight";
import { forestOverlay } from "../forestOverlay";
import { loadFeatures, type TerrainFeatures } from "../terrainFeatures";
import type { Plan, Point } from "../model";
import type { LayerSettings } from "./ReferenceLayer";
import "../flight.css";

export default function BoardTerrain({
  plan,
  layers,
  drawings,
  terrainColor,
  terrainLighting,
  treeOutlines,
  onAdd,
}: {
  plan: Plan;
  layers: LayerSettings;
  drawings: boolean;
  terrainColor: boolean;
  terrainLighting: boolean;
  treeOutlines: boolean;
  onAdd: (p: Point) => void;
}) {
  const [grid, setGrid] = useState<TerrainGrid | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [exaggeration, setExaggeration] = useState(1);
  const [features, setFeatures] = useState<TerrainFeatures | null>(null);
  const [featureStatus, setFeatureStatus] = useState("");
  const [structures, setStructures] = useState(true),
    [canopy, setCanopy] = useState(true);
  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const abort = new AbortController();
      setFeatureStatus("Loading buildings and trees…");
      loadFeatures(plan.map.name).then(
        (next) => {
          if (abort.signal.aborted) return;
          setFeatures(next);
          setFeatureStatus("");
        },
        (e: unknown) => {
          if (!abort.signal.aborted)
            setFeatureStatus(
              e instanceof Error ? e.message : "Terrain detail unavailable.",
            );
        },
      );
      void fetch(assetUrl(`/terrain/${plan.map.name.toLowerCase()}/preview.json`), {
        signal: abort.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw Error("Terrain unavailable. Reconnect and retry.");
          const data: unknown = await r.json();
          if (!isTerrainGrid(data)) throw Error("Unsupported terrain preview.");
          if (!abort.signal.aborted) {
            setGrid(data);
            setError("");
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted)
            setError(e instanceof Error ? e.message : "Terrain unavailable.");
        });
      return () => abort.abort();
    },
    [plan.map.name],
  );
  const coverVisual = useMemo(
    () =>
      grid && treeOutlines
        ? forestOverlay(
            plan.flight?.autoTrees,
            plan.flight?.treeAreas ?? [],
            grid,
          )
        : null,
    [grid, plan.flight?.autoTrees, plan.flight?.treeAreas, treeOutlines],
  );
  return (
    <div className="board-terrain">
      <div ref={mount} key={retry} />
      {grid ? (
        <>
          <FlightMap
            grid={grid}
            map={plan.map}
            state={{
              context: "board",
              boardMarks: drawings ? plan.marks : [],
              image: mapImage(plan.map, terrainColor),
              terrainLighting,
              treeOutlines,
              coverVisual,
              treeDraft: [],
              towers: layers.towers,
              spawns: layers.spawns,
              flight: {
                ...emptyFlight(),
                autoTrees: plan.flight?.autoTrees,
                treeAreas: plan.flight?.treeAreas,
              },
              samples: [],
              candidates: [],
              selected: -1,
              focus: null,
              mode: "3d",
              exaggeration,
              features,
              mission: plan.mission,
              structures,
              canopy,
              onAdd,
              onSelect: () => {},
            }}
          />
          <div className="board-features" role="group" aria-label="3D detail">
            <label>
              <input
                type="checkbox"
                checked={structures}
                disabled={!features}
                onChange={(e) => setStructures(e.target.checked)}
              />
              Structures
            </label>
            <label>
              <input
                type="checkbox"
                checked={canopy}
                disabled={!features}
                onChange={(e) => setCanopy(e.target.checked)}
              />
              Trees
            </label>
            {featureStatus && <span role="status">{featureStatus}</span>}
            {plan.mission?.gun && (
              <span>Fire arcs are schematic connectors, not shell paths.</span>
            )}
          </div>
          <label className="board-height">
            Height scale{" "}
            <select
              aria-label="Board height scale"
              value={exaggeration}
              onChange={(e) => setExaggeration(Number(e.target.value))}
            >
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
        </>
      ) : (
        <TerrainLoading
          mapName={plan.map.name}
          error={error}
          onRetry={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
