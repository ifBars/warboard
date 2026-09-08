import { useCallback, useRef, useState } from "react";
import { WandSparkles, X } from "lucide-react";
import { landmarks, mapData } from "../cartography";
import { parseCoordinates } from "../ballistics";
import {
  emptyFlight,
  isFlight,
  type Flight,
  type TerrainGrid,
} from "../flight";
import type { Plan, Point } from "../model";
import type {
  AutoFlightOptions,
  AutoFlightRequest,
  AutoFlightResult,
} from "../autoFlight";

export default function AutoFlightBuilder({
  plan,
  grid,
  onPreview,
  onApply,
  onDiscard,
}: {
  plan: Plan;
  grid: TerrainGrid;
  onPreview: (flight: Flight) => void;
  onApply: (flight: Flight) => void;
  onDiscard: () => void;
}) {
  const data = mapData(plan.map),
    flight = plan.flight ?? emptyFlight();
  const locations: { id: string; label: string; point: Point }[] = [
    ...(data?.polygons.map((p) => ({
      id: p.label,
      label: p.label.replace("Spawn", "base"),
      point: {
        x: p.points.reduce((s, p) => s + p.x, 0) / p.points.length / 100,
        y: p.points.reduce((s, p) => s + p.y, 0) / p.points.length / 100,
      },
    })) ?? []),
    ...landmarks(plan.map)
      .filter((p) => p.kind === "tower")
      .map((p) => ({ id: p.name, label: p.name, point: p.point })),
  ];
  const [start, setStart] = useState(
      locations.find((p) => /valkyra/i.test(p.id))?.id ??
        locations[0]?.id ??
        "custom",
    ),
    [end, setEnd] = useState(
      locations.find((p) => p.id === "Tower 4")?.id ?? "custom",
    );
  const [startText, setStartText] = useState(""),
    [endText, setEndText] = useState("");
  const [flank, setFlank] = useState<AutoFlightOptions["flank"]>(
      plan.map.name === "Bakurani" ? "west" : "auto",
    ),
    [style, setStyle] = useState<AutoFlightOptions["style"]>("combat"),
    [nearby, setNearby] = useState(true),
    [landingSide, setLandingSide] = useState<AutoFlightOptions["landingSide"]>(
      plan.map.name === "Bakurani" ? "south" : "auto",
    ),
    [towerClearance, setTowerClearance] = useState(25),
    [brakingDistance, setBrakingDistance] = useState(80),
    [maneuver, setManeuver] = useState<AutoFlightOptions["maneuver"]>("auto"),
    [clearance, setClearance] = useState(18),
    [cruise, setCruise] = useState(65);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "working"; message: string }
    | { kind: "error"; message: string }
    | { kind: "ready"; result: AutoFlightResult; key: string }
  >({ kind: "idle" });
  const worker = useRef<Worker | null>(null);
  const baseKey = JSON.stringify(plan.flight ?? null);
  const key = JSON.stringify([
    baseKey,
    start,
    end,
    startText,
    endText,
    flank,
    style,
    nearby,
    landingSide,
    towerClearance,
    brakingDistance,
    maneuver,
    clearance,
    cruise,
  ]);
  const delivery = useRef(onPreview),
    latestKey = useRef(key);
  const sync = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        delivery.current = onPreview;
        latestKey.current = key;
      }
    },
    [onPreview, key],
  );
  const attach = useCallback((node: HTMLElement | null) => {
    if (node)
      return () => {
        worker.current?.terminate();
        worker.current = null;
      };
  }, []);
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    setState({ kind: "idle" });
    onDiscard();
  }
  function build() {
    const a =
      start === "custom"
        ? parseCoordinates(startText)
        : start === "current"
          ? flight.waypoints[0]
          : locations.find((p) => p.id === start)?.point;
    const b =
      end === "custom"
        ? parseCoordinates(endText)
        : end === "current"
          ? flight.waypoints.at(-1)
          : locations.find((p) => p.id === end)?.point;
    if (!a || !b) {
      setState({
        kind: "error",
        message: "Choose a start and destination, or enter X, Y coordinates.",
      });
      return;
    }
    onDiscard();
    worker.current?.terminate();
    setState({ kind: "working", message: "Preparing route search…" });
    const task = new Worker(
      new URL("../autoFlight.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = task;
    task.onmessage = (
      event: MessageEvent<{
        progress?: string;
        error?: string;
        result?: AutoFlightResult;
      }>,
    ) => {
      if (worker.current !== task) return;
      if (latestKey.current !== key) {
        cancel();
        return;
      }
      const { progress, error, result } = event.data;
      if (progress) setState({ kind: "working", message: progress });
      if (error || result) {
        task.terminate();
        worker.current = null;
        if (error) setState({ kind: "error", message: error });
        else if (result && isFlight(result.flight)) {
          setState({ kind: "ready", result, key });
          delivery.current(result.flight);
        } else
          setState({
            kind: "error",
            message: "The generated route could not be validated.",
          });
      }
    };
    task.onerror = () => {
      if (worker.current === task) {
        task.terminate();
        worker.current = null;
        setState({
          kind: "error",
          message: "Route search failed. Try a shorter route or another flank.",
        });
      }
    };
    const request: AutoFlightRequest = {
      mapName: plan.map.name,
      grid,
      flight,
      towers: landmarks(plan.map)
        .filter((p) => p.kind === "tower")
        .map((p) => p.point),
      options: {
        start: a,
        end: b,
        flank,
        style,
        clearance,
        cruise,
        nearbyLanding: nearby,
        landingSide,
        towerClearance,
        brakingDistance,
        maneuver,
      },
    };
    task.postMessage(request);
  }
  const ready =
    state.kind === "ready" && state.key === key ? state.result : null;
  return (
    <section className="auto-flight-builder" ref={attach}>
      <span hidden ref={sync} />
      <h2>
        <WandSparkles size={16} /> Auto route
      </h2>
      <p>
        Choose endpoints. Preview a curved, terrain-aware route before replacing
        your current flight.
      </p>
      <fieldset
        disabled={state.kind === "working"}
        onChange={() => {
          onDiscard();
          if (state.kind === "ready") setState({ kind: "idle" });
        }}
      >
        <label>
          Takeoff
          <select
            aria-label="Auto route takeoff"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          >
            {locations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="current" disabled={!flight.waypoints.length}>
              Current route start
            </option>
            <option value="custom">Coordinates…</option>
          </select>
        </label>
        {start === "custom" && (
          <label>
            Start X, Y
            <input
              aria-label="Auto route start coordinates"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              placeholder="80.25, 72.50"
            />
          </label>
        )}
        <label>
          Landing destination
          <select
            aria-label="Auto route destination"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          >
            {locations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="current" disabled={!flight.waypoints.length}>
              Current route end
            </option>
            <option value="custom">Coordinates…</option>
          </select>
        </label>
        {end === "custom" && (
          <label>
            LZ X, Y
            <input
              aria-label="Auto route landing coordinates"
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              placeholder="83.64, 72.85"
            />
          </label>
        )}
        <div className="flight-planning-row">
          <label>
            Flight style
            <select
              value={style}
              onChange={(e) =>
                setStyle(
                  e.target.value === "transport" ? "transport" : "combat",
                )
              }
            >
              <option value="combat">Low / combat</option>
              <option value="transport">Transport</option>
            </select>
          </label>
          <label>
            Approach flank
            <select
              value={flank}
              onChange={(e) => {
                const v = e.target.value;
                if (
                  v === "auto" ||
                  v === "east" ||
                  v === "west" ||
                  v === "north" ||
                  v === "south"
                )
                  setFlank(v);
              }}
            >
              <option value="auto">Automatic</option>
              <option value="east">East / right</option>
              <option value="west">West / left</option>
              <option value="north">North</option>
              <option value="south">South</option>
            </select>
          </label>
        </div>
        <label>
          Landing side of destination
          <select
            aria-label="Landing side"
            value={landingSide}
            disabled={!nearby}
            onChange={(e) => {
              const v = e.target.value;
              if (
                v === "auto" ||
                v === "east" ||
                v === "west" ||
                v === "north" ||
                v === "south"
              )
                setLandingSide(v);
            }}
          >
            <option value="auto">Any clear side</option>
            <option value="west">West / map left</option>
            <option value="east">East / map right</option>
            <option value="north">North / map top</option>
            <option value="south">South / map bottom</option>
          </select>
        </label>
        <p className="flight-small">
          Compass directions refer to the north-up map, not the pilot's heading.
        </p>
        <label>
          Landing maneuver
          <select
            value={maneuver}
            onChange={(e) => {
              const v = e.target.value;
              if (
                v === "auto" ||
                v === "j-hook" ||
                v === "direct" ||
                v === "s-turn"
              )
                setManeuver(v);
            }}
          >
            <option value="auto">Automatic</option>
            <option value="j-hook">J-hook</option>
            <option value="s-turn">S-turn</option>
            <option value="direct">Direct</option>
          </select>
        </label>
        <details>
          <summary>Clearance preferences</summary>
          <label>
            Braking distance from destination (m)
            <input
              aria-label="Braking distance"
              type="number"
              min="50"
              max="500"
              step="10"
              value={brakingDistance}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n))
                  setBrakingDistance(Math.max(50, Math.min(500, n)));
              }}
            />
          </label>
          <p className="flight-small">
            Sets the turn entry on the chosen approach side, at least 20 m
            beyond the tower buffer. Combat turns use compact 25�60 m handles;
            these are tunable estimates.
          </p>
          <label>
            Tower exclusion radius (m)
            <input
              aria-label="Tower exclusion radius"
              type="number"
              min="25"
              max="200"
              step="5"
              value={towerClearance}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n))
                  setTowerClearance(Math.max(25, Math.min(200, n)));
              }}
            />
          </label>
          <p className="flight-small">
            Goes around towers at every altitude. Radius is a planning margin;
            tower dimensions are unverified.
          </p>
          <div className="flight-planning-row">
            <label>
              Transit AGL (m)
              <input
                type="number"
                min="30"
                max="250"
                value={cruise}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n))
                    setCruise(Math.max(30, Math.min(250, n)));
                }}
              />
            </label>
            <label>
              Near towers AGL (m)
              <input
                type="number"
                min="12"
                max="100"
                value={clearance}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n))
                    setClearance(Math.max(12, Math.min(100, n)));
                }}
              />
            </label>
          </div>
          <p>
            Minimum 12 m above estimated canopy. Routing may climb higher to
            clear terrain or trees.
          </p>
        </details>
        <label className="auto-flight-check">
          <input
            type="checkbox"
            checked={nearby}
            onChange={(e) => setNearby(e.target.checked)}
          />{" "}
          Find a nearby clear, flatter LZ (within 215 m)
        </label>
      </fieldset>
      {state.kind === "working" ? (
        <div role="status">
          <p>{state.message}</p>
          <button type="button" onClick={cancel}>
            <X size={14} /> Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="primary"
          aria-label="Build route preview"
          onClick={build}
        >
          <WandSparkles size={15} />{" "}
          {ready ? "Rebuild preview" : "Build route preview"}
        </button>
      )}
      {state.kind === "error" && (
        <p role="alert" className="flight-warning">
          {state.message}
        </p>
      )}
      {ready && (
        <div className="auto-flight-result" role="status">
          <strong>
            Preview · {(ready.distance / 1000).toFixed(2)} km ·{" "}
            {ready.flight.waypoints.length} waypoints
          </strong>
          <p>
            {ready.pattern} approach · LZ offset{" "}
            {ready.landingOffset.toFixed(0)} m · terrain checks ≤
            {Math.ceil(ready.spacing)} m apart
          </p>
          {ready.warnings.map((w) => (
            <p className="flight-small" key={w}>
              {w}
            </p>
          ))}
          <button
            className="primary"
            type="button"
            onClick={() => {
              onApply(ready.flight);
              setState({ kind: "idle" });
            }}
          >
            Use this route
          </button>
          <button type="button" onClick={cancel}>
            Discard preview
          </button>
        </div>
      )}
      <p className="flight-small">
        Planning estimate. Uses road corridors, static structure surfaces and
        placed-tree bounds. Turn shapes do not simulate aircraft speed, banking
        or burn timing.
      </p>
    </section>
  );
}
