import { assetUrl } from "../assetUrl";
import AutoFlightBuilder from "../components/AutoFlightBuilder";
import { mapImage } from "../mapImagery";
import { builtIns } from "../maps";
import TerrainColorChoice from "../components/TerrainColorChoice";
import TerrainLoading from "../components/TerrainLoading";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Plus, Plane } from "lucide-react";
import {
  emptyFlight,
  coverHeight,
  gridHeight,
  isTerrainGrid,
  routeLocations,
  routeAltitudes,
  type Flight,
  type FlightWaypoint,
  type LandingCandidate,
  type RouteSample,
  type TerrainGrid,
} from "../flight";
import { forestOverlay } from "../forestOverlay";
import { terrainHeights } from "../terrain";
import { findFlatGround } from "../landing";
import { landmarks, mapData } from "../cartography";
import { towerSegmentClear } from "../autoFlight";
import type { Plan, Point } from "../model";
import MapLayersDropdown from "../components/MapLayersDropdown";
import FlightMap from "../components/FlightMap";
import FlightPlanningControls from "../components/FlightPlanningControls";
import FlightProfile from "../components/FlightProfile";
import "../flight.css";
const noSamples: RouteSample[] = [];

export default function FlightPlanner({
  plan,
  onChange,
  status,
  terrainColor,
  onTerrainColor,
  terrainLighting,
  treeOutlines,
  onTreeOutlines,
  onTerrainLighting,
  onMapChange,
  mapBusy,
}: {
  plan: Plan;
  onChange: (flight: Flight) => void;
  status: string;
  terrainColor: boolean;
  terrainLighting: boolean;
  treeOutlines: boolean;
  onTreeOutlines: (value: boolean) => void;
  onTerrainLighting: (value: boolean) => void;
  onTerrainColor: (value: boolean) => void;
  onMapChange: (id: string) => void;
  mapBusy: boolean;
}) {
  const [grid, setGrid] = useState<TerrainGrid | null>(null),
    [error, setError] = useState("");
  const supported = !!mapData(plan.map);
  const load = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !supported) return;
      let active = true;
      void fetch(assetUrl(`/terrain/${plan.map.name.toLowerCase()}/preview.json`))
        .then(async (r) => {
          if (!r.ok)
            throw new Error(
              "Terrain preview unavailable. Reconnect and retry.",
            );
          const data: unknown = await r.json();
          if (!isTerrainGrid(data))
            throw new Error("Unsupported terrain preview.");
          if (active) setGrid(data);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Could not load terrain.",
            );
        });
      return () => {
        active = false;
      };
    },
    [plan.map.name, supported],
  );
  const [retry, setRetry] = useState(0);
  return (
    <div className="flight-page">
      <div ref={load} key={retry} />
      {!supported ? (
        <TerrainLoading
          mapName={plan.map.name}
          error="Choose Bakurani or Ozeti on Board to explore terrain."
          backToBoard
        />
      ) : grid ? (
        <FlightWorkspace
          plan={plan}
          grid={grid}
          onChange={onChange}
          status={status}
          terrainColor={terrainColor}
          treeOutlines={treeOutlines}
          onTreeOutlines={onTreeOutlines}
          terrainLighting={terrainLighting}
          onTerrainLighting={onTerrainLighting}
          onTerrainColor={onTerrainColor}
          onMapChange={onMapChange}
          mapBusy={mapBusy}
        />
      ) : (
        <TerrainLoading
          mapName={plan.map.name}
          error={error}
          backToBoard
          onRetry={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
function FlightWorkspace({
  plan,
  grid,
  onChange: saveFlight,
  status,
  terrainColor,
  onTerrainColor,
  terrainLighting,
  treeOutlines,
  onTreeOutlines,
  onTerrainLighting,
  onMapChange,
  mapBusy,
}: {
  plan: Plan;
  grid: TerrainGrid;
  onChange: (flight: Flight) => void;
  status: string;
  terrainColor: boolean;
  terrainLighting: boolean;
  treeOutlines: boolean;
  onTreeOutlines: (value: boolean) => void;
  onTerrainLighting: (value: boolean) => void;
  onTerrainColor: (value: boolean) => void;
  onMapChange: (id: string) => void;
  mapBusy: boolean;
}) {
  const editRevision = useRef(0);
  const lifecycle = useCallback((node: HTMLSpanElement | null) => {
    if (node)
      return () => {
        editRevision.current++;
      };
  }, []);
  const [preview, setPreview] = useState<{
    base: string;
    flight: Flight;
  } | null>(null);
  const baseKey = JSON.stringify(plan.flight ?? null);
  const previewFlight =
    preview && preview.base === baseKey ? preview.flight : null;
  function onChange(next: Flight) {
    setPreview(null);
    editRevision.current++;
    saveFlight(next);
  }
  const flight = previewFlight ?? plan.flight ?? emptyFlight();
  const coverVisual = useMemo(
    () =>
      treeOutlines
        ? forestOverlay(flight.autoTrees, flight.treeAreas ?? [], grid)
        : null,
    [flight.autoTrees, flight.treeAreas, grid, treeOutlines],
  );
  const [towers, setTowers] = useState(true),
    [spawns, setSpawns] = useState(true);
  const [mode, setMode] = useState<"2d" | "3d">("3d"),
    [exaggeration, setExaggeration] = useState(1),
    [selected, setSelected] = useState(0),
    [profileIndex, setProfileIndex] = useState(0);
  const [analysis, setAnalysis] = useState<{
    key: string;
    samples: RouteSample[];
    error: string;
  }>({ key: "", samples: [], error: "" });
  const [treeDraft, setTreeDraft] = useState<Point[] | null>(null);
  const coordinateKey = flight.waypoints.map((p) => `${p.x},${p.y}`).join(";");
  const approachType = flight.approach?.type ?? "direct",
    approachSide = flight.approach?.side ?? "left",
    approachSize = flight.approach?.size ?? 100,
    approachEntry = flight.approach?.entryAligned ?? false;
  const locations = useMemo(
    () =>
      routeLocations(
        coordinateKey
          ? coordinateKey.split(";").map((pair) => {
              const [x, y] = pair.split(",").map(Number);
              return { x, y };
            })
          : [],
        {
          type: approachType,
          side: approachSide,
          size: approachSize,
          entryAligned: approachEntry,
        },
        flight.turns === "smooth",
      ),
    [
      coordinateKey,
      approachType,
      approachSide,
      approachSize,
      approachEntry,
      flight.turns,
    ],
  );
  const routeKey = JSON.stringify(locations);
  const towerPositions = landmarks(plan.map)
    .filter((t) => t.kind === "tower")
    .map((t) => t.point);
  const towerRadius = flight.towerBuffer ?? 0;
  const towerConflict =
    towerRadius > 0 &&
    locations.some(
      (p, i) =>
        !towerSegmentClear(
          locations[Math.max(0, i - 1)],
          p,
          towerPositions,
          towerRadius,
        ),
    );

  const [analysisRetry, setAnalysisRetry] = useState(0);
  const sample = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node) return;
      let active = true;
      if (locations.length)
        void terrainHeights(plan.map.name, locations)
          .then((heights) => {
            if (active)
              setAnalysis({
                key: routeKey,
                samples: locations.map((p, i) => ({
                  ...p,
                  ground: heights[i],
                })),
                error: "",
              });
          })
          .catch((e) => {
            if (active)
              setAnalysis({
                key: routeKey,
                samples: [],
                error:
                  e instanceof Error ? e.message : "Could not sample route.",
              });
          });
      else setAnalysis({ key: routeKey, samples: [], error: "" });
      return () => {
        active = false;
      };
    },
    [routeKey, locations, plan.map.name],
  );
  const samples = analysis.key === routeKey ? analysis.samples : noSamples;
  const profile = useMemo(
    () => routeAltitudes(flight, samples),
    [flight, samples],
  );
  const [candidates, setCandidates] = useState<{
      key: string;
      items: LandingCandidate[];
    } | null>(null),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [radius, setRadius] = useState(10),
    [slope, setSlope] = useState(5),
    [roughness, setRoughness] = useState(0.5);
  const searchRevision = useRef(0);
  const point = flight.waypoints[selected];
  const searchKey = point
    ? `${point.x},${point.y},${radius},${slope},${roughness}`
    : "";
  const shownCandidates = candidates?.key === searchKey ? candidates.items : [];
  const [newX, setNewX] = useState(((grid.minX + grid.maxX) / 2).toFixed(2)),
    [newY, setNewY] = useState(((grid.minY + grid.maxY) / 2).toFixed(2)),
    [inputError, setInputError] = useState("");
  function add(p: Point, name?: string) {
    if (flight.waypoints.length >= 32) {
      setInputError("A route can contain up to 32 waypoints.");
      return;
    }
    const h = gridHeight(grid, p);
    if (h === null) {
      setInputError("Choose a point inside terrain coverage.");
      return;
    }
    setInputError("");
    const next = {
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      id: crypto.randomUUID(),
      name: name ?? `Waypoint ${flight.waypoints.length + 1}`,
      altitude: flight.mode === "agl" ? 100 : Math.round(h + 100),
    };
    onChange({ ...flight, waypoints: [...flight.waypoints, next] });
    setSelected(flight.waypoints.length);
  }
  function edit(index: number, patch: Partial<FlightWaypoint>) {
    onChange({
      ...flight,
      waypoints: flight.waypoints.map((w, i) =>
        i === index ? { ...w, ...patch } : w,
      ),
    });
  }
  function move(index: number, offset: number) {
    const waypoints = [...flight.waypoints],
      target = index + offset;
    [waypoints[index], waypoints[target]] = [
      waypoints[target],
      waypoints[index],
    ];
    onChange({ ...flight, waypoints });
    setSelected(target);
  }
  async function search() {
    if (!point) return;
    const revision = ++searchRevision.current;
    setSearching(true);
    setSearchError("");
    try {
      const items = await findFlatGround(
        plan.map.name,
        point,
        grid,
        radius,
        slope,
        roughness,
      );
      if (revision === searchRevision.current)
        setCandidates({ key: searchKey, items });
    } catch (e) {
      if (revision === searchRevision.current)
        setSearchError(
          e instanceof Error ? e.message : "Flat-ground search failed.",
        );
    } finally {
      if (revision === searchRevision.current) setSearching(false);
    }
  }
  async function changeAltitudeMode(next: Flight["mode"]) {
    if (next === flight.mode) return;
    const revision = ++editRevision.current;
    try {
      const heights = await terrainHeights(plan.map.name, flight.waypoints);
      if (revision !== editRevision.current) return;
      onChange({
        ...flight,
        mode: next,
        waypoints: flight.waypoints.map((w, i) => ({
          ...w,
          altitude: Math.max(
            next === "agl" ? 0 : -2000,
            Math.min(
              5000,
              Math.round(
                w.altitude + (next === "absolute" ? heights[i] : -heights[i]),
              ),
            ),
          ),
        })),
      });
    } catch {
      if (revision !== editRevision.current) return;
      setInputError(
        "Could not convert altitude reference. Try again when terrain data is available.",
      );
    }
  }
  const collisions = profile.filter((p) => p.altitude <= p.ground).length;
  const spacing = profile
    .slice(1)
    .reduce((max, p, i) => Math.max(max, p.distance - profile[i].distance), 0);
  return (
    <>
      <span hidden ref={lifecycle} />
      <div className="flight-toolbar">
        <h1>
          <Plane size={19} /> Flight planner
        </h1>
        <select
          aria-label="Flight map"
          value={builtIns.find((m) => m.name === plan.map.name)?.id ?? ""}
          disabled={mapBusy}
          onChange={(e) => onMapChange(e.target.value)}
        >
          {builtIns.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="flight-view-toggle">
          <button
            type="button"
            aria-pressed={mode === "2d"}
            onClick={() => setMode("2d")}
          >
            2D
          </button>
          <button
            type="button"
            aria-pressed={mode === "3d"}
            onClick={() => setMode("3d")}
          >
            3D
          </button>
        </div>
        <label>
          Height scale
          <select
            aria-label="Vertical exaggeration"
            value={exaggeration}
            onChange={(e) => setExaggeration(Number(e.target.value))}
          >
            <option value="1">1× actual</option>
            <option value="1.5">1.5× visual</option>
            <option value="2">2× visual</option>
          </select>
        </label>
        <MapLayersDropdown>
          <TerrainColorChoice
            treeOutlines={treeOutlines}
            onTreeOutlines={onTreeOutlines}
            enabled={terrainColor}
            lighting={terrainLighting}
            onLightingChange={onTerrainLighting}
            onChange={onTerrainColor}
          />{" "}
          <section className="flight-layers">
            <h2>Map references</h2>
            <label>
              <input
                type="checkbox"
                checked={towers}
                onChange={(e) => setTowers(e.target.checked)}
              />
              Towers
            </label>
            <label>
              <input
                type="checkbox"
                checked={spawns}
                onChange={(e) => setSpawns(e.target.checked)}
              />
              Spawn boundaries
            </label>
            <p>
              Tower locations are reference markers; tower heights and collision
              geometry are not included.
            </p>
          </section>
        </MapLayersDropdown>
        <a href="#/board">Back to board</a>
      </div>
      <div className="flight-layout">
        <main className="flight-main">
          <FlightMap
            grid={grid}
            map={plan.map}
            state={{
              coverVisual,
              treeOutlines,
              image: mapImage(plan.map, terrainColor),
              terrainLighting,
              towers,
              spawns,
              flight,
              samples,
              candidates: shownCandidates,
              selected,
              focus:
                profile[Math.min(profileIndex, profile.length - 1)] ??
                point ??
                null,
              mode,
              exaggeration,
              treeDraft: treeDraft ?? [],
              onAdd: (p) => {
                if (previewFlight) return;
                if (treeDraft !== null) {
                  if (treeDraft.length < 64) setTreeDraft([...treeDraft, p]);
                } else add(p);
              },
              onSelect: setSelected,
            }}
          />
          <FlightProfile
            samples={profile}
            index={profileIndex}
            onSelect={setProfileIndex}
          />
        </main>
        <aside className="flight-inspector">
          {towerConflict && (
            <p className="flight-cover-warning" role="alert">
              Route enters a {flight.towerBuffer} m tower exclusion zone. Move
              the turn or landing point outside the marked buffer; altitude does
              not clear it.
            </p>
          )}
          <AutoFlightBuilder
            plan={plan}
            grid={grid}
            onPreview={(next) => {
              setPreview({ base: baseKey, flight: next });
              setSelected(0);
            }}
            onApply={onChange}
            onDiscard={() => setPreview(null)}
          />
          {previewFlight && (
            <p className="flight-cover-warning">
              Preview only. Use this route to save and edit its waypoints.
            </p>
          )}
          <fieldset
            className="flight-manual-controls"
            disabled={!!previewFlight}
          >
            <FlightPlanningControls
              flight={flight}
              mapName={plan.map.name}
              onChange={onChange}
              draft={treeDraft}
              onDraft={setTreeDraft}
              onTrace={() => {
                setMode("2d");
                setTreeDraft([]);
              }}
            />
            {profile.some(
              (p) =>
                coverHeight(p, flight, grid) > 0 &&
                p.altitude - p.ground <= coverHeight(p, flight, grid) + 10,
            ) && (
              <p className="flight-cover-warning" role="status">
                Route enters estimated tree clearance: canopy height + 10 m
                vertically, with a 10 m boundary buffer. Raise affected waypoint
                altitudes or move the route around the outline.
              </p>
            )}

            <section>
              <h2>
                Your flight path <span>{flight.waypoints.length}/32</span>
              </h2>
              <p>
                Double-click the map to add a waypoint, or enter game
                coordinates below.
              </p>
              <span hidden ref={sample} key={analysisRetry} />
              <div className="flight-coordinate-entry">
                <label>
                  X
                  <input
                    aria-label="New waypoint X"
                    type="number"
                    step=".01"
                    value={newX}
                    onChange={(e) => setNewX(e.target.value)}
                  />
                </label>
                <label>
                  Y
                  <input
                    aria-label="New waypoint Y"
                    type="number"
                    step=".01"
                    value={newY}
                    onChange={(e) => setNewY(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Add waypoint"
                  disabled={
                    !newX ||
                    !newY ||
                    !Number.isFinite(Number(newX)) ||
                    !Number.isFinite(Number(newY)) ||
                    flight.waypoints.length >= 32
                  }
                  onClick={() => add({ x: Number(newX), y: Number(newY) })}
                >
                  <Plus size={18} />
                </button>
              </div>
              {inputError && <p role="alert">{inputError}</p>}
              <label className="flight-altitude-mode">
                Altitude reference
                <select
                  aria-label="Altitude reference"
                  value={flight.mode}
                  onChange={(e) =>
                    void changeAltitudeMode(
                      e.target.value === "absolute" ? "absolute" : "agl",
                    )
                  }
                >
                  <option value="agl">Above ground (AGL)</option>
                  <option value="absolute">Absolute terrain elevation</option>
                </select>
              </label>
              <p className="flight-small">
                {flight.mode === "agl"
                  ? "Clearance follows sampled terrain between waypoints. Aircraft climb performance is not simulated."
                  : "Flight altitude interpolates between waypoints. Absolute terrain elevation is not yet calibrated to the cockpit altimeter."}
              </p>
              <ol className="flight-waypoints">
                {flight.waypoints.map((w, i) => (
                  <li key={w.id} className={selected === i ? "selected" : ""}>
                    <button
                      className="waypoint-select"
                      type="button"
                      aria-label={`Select waypoint ${i + 1}`}
                      aria-pressed={selected === i}
                      onClick={() => setSelected(i)}
                    >
                      {i + 1}
                    </button>
                    <div>
                      <input
                        title="Waypoint name"
                        aria-label={`Waypoint ${i + 1} name`}
                        value={w.name}
                        maxLength={80}
                        onChange={(e) => edit(i, { name: e.target.value })}
                      />
                      <span>
                        {w.x.toFixed(2)}, {w.y.toFixed(2)}
                      </span>
                      {selected === i && (
                        <div className="waypoint-coordinates">
                          {(["x", "y"] as const).map((axis) => (
                            <label key={axis}>
                              {axis.toUpperCase()}
                              <input
                                title="Waypoint coordinate"
                                aria-label={`Waypoint ${i + 1} ${axis.toUpperCase()}`}
                                type="number"
                                step=".01"
                                value={w[axis]}
                                onChange={(e) => {
                                  const value = e.target.valueAsNumber;
                                  const p = { x: w.x, y: w.y, [axis]: value };
                                  if (
                                    Number.isFinite(value) &&
                                    gridHeight(grid, p) !== null
                                  )
                                    edit(i, { [axis]: value });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      <label>
                        Altitude (m)
                        <input
                          aria-label={`Waypoint ${i + 1} altitude`}
                          type="number"
                          min={flight.mode === "agl" ? 0 : -2000}
                          max="5000"
                          step="10"
                          value={w.altitude}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber;
                            if (
                              Number.isFinite(n) &&
                              n >= (flight.mode === "agl" ? 0 : -2000) &&
                              n <= 5000
                            )
                              edit(i, { altitude: n });
                          }}
                        />
                      </label>
                    </div>
                    <div className="waypoint-actions">
                      <button
                        type="button"
                        aria-label={`Move waypoint ${i + 1} up`}
                        title="Move waypoint up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move waypoint ${i + 1} down`}
                        title="Move waypoint down"
                        disabled={i === flight.waypoints.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete waypoint ${i + 1}`}
                        title="Delete waypoint"
                        onClick={() => {
                          onChange({
                            ...flight,
                            waypoints: flight.waypoints.filter(
                              (_, j) => j !== i,
                            ),
                          });
                          setSelected(
                            Math.max(
                              0,
                              Math.min(selected, flight.waypoints.length - 2),
                            ),
                          );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {flight.waypoints.length >= 2 && (
                <p
                  className={collisions ? "flight-warning" : "flight-small"}
                  role="status"
                >
                  {analysis.key !== routeKey
                    ? "Sampling route terrain…"
                    : analysis.error
                      ? analysis.error
                      : collisions
                        ? `${collisions} sampled positions touch or intersect terrain.`
                        : `No terrain intersections at sampled positions (up to ${spacing.toFixed(0)} m apart). Only terrain and enabled detected cover and manual tree areas are checked; other obstacles remain unknown.`}
                  {analysis.error && (
                    <button
                      type="button"
                      onClick={() => setAnalysisRetry((n) => n + 1)}
                    >
                      Retry analysis
                    </button>
                  )}
                </p>
              )}
              <p className="flight-save" role="status">
                {status} · included in editable plan exports
              </p>
            </section>
            <section>
              <h2>Find flatter ground</h2>
              <p>
                Search within 150 m east/west and north/south of the selected
                waypoint. Candidates describe ground shape only.
              </p>
              <div className="flight-search-options">
                <label>
                  Footprint
                  <select
                    aria-label="Landing footprint"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  >
                    <option value="6">12 × 12 m</option>
                    <option value="10">20 × 20 m</option>
                    <option value="16">32 × 32 m</option>
                  </select>
                </label>
                <label>
                  Max slope (°)
                  <input
                    aria-label="Maximum landing slope"
                    type="number"
                    min="0"
                    max="20"
                    step="1"
                    value={slope}
                    onChange={(e) => {
                      if (Number.isFinite(e.target.valueAsNumber))
                        setSlope(
                          Math.max(0, Math.min(20, e.target.valueAsNumber)),
                        );
                    }}
                  />
                </label>
                <label>
                  Max unevenness (m)
                  <input
                    aria-label="Maximum ground unevenness"
                    type="number"
                    min="0"
                    max="5"
                    step=".1"
                    value={roughness}
                    onChange={(e) => {
                      if (Number.isFinite(e.target.valueAsNumber))
                        setRoughness(
                          Math.max(0, Math.min(5, e.target.valueAsNumber)),
                        );
                    }}
                  />
                </label>
              </div>
              <button
                type="button"
                className="primary"
                disabled={!point || searching}
                onClick={() => void search()}
              >
                {searching
                  ? "Checking terrain…"
                  : "Find flat-ground candidates"}
              </button>
              <p className="flight-small">
                User-selected criteria, not aircraft limits. Samples every 2 m.
                Unevenness is the largest deviation from a fitted plane.
              </p>
              {searchError && <p role="alert">{searchError}</p>}
              {candidates?.key === searchKey &&
                shownCandidates.length === 0 && (
                  <p role="status">
                    No footprints meet these criteria here. Move the waypoint or
                    adjust the criteria.
                  </p>
                )}
              <ul className="flight-candidates">
                {shownCandidates.map((c, i) => (
                  <li key={`${c.x},${c.y}`}>
                    <strong>
                      {String.fromCharCode(65 + i)} · {c.slope.toFixed(1)}°
                      slope
                    </strong>
                    <span>
                      {c.roughness.toFixed(2)} m unevenness ·{" "}
                      {c.relief.toFixed(1)} m total relief
                    </span>
                    {coverHeight(c, flight, grid, c.radius * Math.SQRT2 + 10) >
                      0 && (
                      <span className="flight-warning">
                        Footprint overlaps estimated tree cover. Inspect or
                        choose another spot.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        add(
                          c,
                          `Landing candidate ${String.fromCharCode(65 + i)} (unverified)`,
                        );
                      }}
                    >
                      Add candidate waypoint
                    </button>
                  </li>
                ))}
              </ul>
              <p className="flight-warning">
                Unverified landing spots. Detected and traced cover is flagged;
                unmarked trees, wires, buildings, water, moving objects and
                rotor clearance are not tested. Inspect in game before landing.
              </p>
            </section>
            <section className="flight-provenance">
              <p>
                Tree detection source:{" "}
                <a
                  href={`https://wardogs.zone/maps/${plan.map.name === "Bakurani" ? "kavkazi" : "europe"}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Wardogs Zone
                </a>
                . Detected cover is an image estimate, not collision geometry.
              </p>
              <p>
                Terrain: pinned Apollyon dataset · display mesh ≈64 m · analysis
                uses the original 2 m height field. Vertical exaggeration
                changes the view only.
              </p>
              <a
                href="https://github.com/apollyon-sys/wardogs-calculator"
                target="_blank"
                rel="noreferrer"
              >
                Terrain source ↗
              </a>
            </section>
          </fieldset>
        </aside>
      </div>
    </>
  );
}
