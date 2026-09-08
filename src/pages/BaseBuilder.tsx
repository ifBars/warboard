import { lazy, Suspense, useRef, useState, type PointerEvent } from "react";
import {
  RotateCw,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Upload,
  MapPin,
} from "lucide-react";
import {
  basePiece,
  baseWarnings,
  buildables,
  footprint,
  fobRange,
  validBase,
  type BasePiece,
  type BasePlan,
} from "../base";
import { toPixel } from "../cartography";
import type { Plan, Point, Mark } from "../model";
import { download } from "../storage";
import "../base.css";
const BasePreview = lazy(() => import("../components/BasePreview"));
export default function BaseBuilder({
  plan,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBoard,
}: {
  plan: Plan;
  onChange: (plan: Plan) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBoard: () => void;
}) {
  const base: BasePlan = plan.base ?? {
    version: 1,
    anchor: { x: 81.6, y: 81.6 },
    pieces: [],
  };
  const [selected, setSelected] = useState<string | null>(null),
    [kind, setKind] = useState("fob"),
    [search, setSearch] = useState(""),
    [mode, setMode] = useState<"2d" | "3d">("2d"),
    [snap, setSnap] = useState(1),
    [error, setError] = useState("");
  const [extent, setExtent] = useState(50),
    [center, setCenter] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState<BasePiece | null>(null);
  const drag = useRef<{ start: Point; original: BasePiece } | null>(null);
  const pan = useRef<{ x: number; y: number; center: Point } | null>(null);
  const input = useRef<HTMLInputElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const shown = {
    ...base,
    pieces: base.pieces.map((p) => (draft?.id === p.id ? draft : p)),
  };
  const piece = shown.pieces.find((p) => p.id === selected),
    spec = piece ? basePiece(piece.kind) : null;
  function update(next: BasePlan) {
    if (!validBase(next)) {
      setError("That edit exceeds the base limits.");
      return;
    }
    setError("");
    onChange({ ...plan, base: next });
  }
  function changePiece(p: BasePiece) {
    update({
      ...base,
      pieces: base.pieces.map((v) => (v.id === p.id ? p : v)),
    });
  }
  function position(e: PointerEvent<SVGSVGElement>): Point {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return {
      x: Math.round(pt.x / snap) * snap,
      y: -Math.round(pt.y / snap) * snap,
    };
  }
  function add() {
    if (base.pieces.length >= 500) {
      setError("A base can contain up to 500 pieces.");
      return;
    }
    const p = {
      id: crypto.randomUUID(),
      kind,
      x: 0,
      y: 0,
      elevation: 0,
      rotation: 0,
    };
    update({ ...base, pieces: [...base.pieces, p] });
    setSelected(p.id);
  }
  async function importFile(file: File) {
    try {
      if (file.size > 250000) throw Error("Base file exceeds 250 KB.");
      const value: unknown = JSON.parse(await file.text());
      if (!validBase(value)) throw Error("Not a supported WARBOARD base file.");
      update(value);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import base.");
    }
  }
  function toBoard() {
    if (!toPixel(base.anchor, plan.map)) {
      setError("Board placement requires a built-in map.");
      return;
    }
    const marks: Mark[] = base.pieces.map((p) => {
      const points = footprint(p).map((v) =>
        toPixel(
          { x: base.anchor.x + v.x / 100, y: base.anchor.y + v.y / 100 },
          plan.map,
        )!,
      );
      return {
        id: crypto.randomUUID(),
        type: "pen",
        color: p.kind === "fob" ? "#e8bb48" : "#73b7da",
        width: 2,
        text: "",
        points: [...points, points[0]],
      };
    });
    if (plan.marks.length + marks.length > 2000) {
      setError("The Board annotation limit would be exceeded.");
      return;
    }
    onChange({ ...plan, marks: [...plan.marks, ...marks] });
    onBoard();
  }
  const totals = buildables
    .map((b) => ({
      ...b,
      count: base.pieces.filter((p) => p.kind === b.id).length,
    }))
    .filter((b) => b.count);
  return (
    <div className="base-builder">
      <header className="base-header">
        <h1>Base builder</h1>
        <span>{plan.map.name}</span>
        <div className="base-view-switch">
          <button
            type="button"
            aria-pressed={mode === "2d"}
            onClick={() => setMode("2d")}
          >
            Footprints
          </button>
          <button
            type="button"
            aria-pressed={mode === "3d"}
            onClick={() => setMode("3d")}
          >
            3D envelopes
          </button>
        </div>
        <button
          type="button"
          aria-label="Undo base edit"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          aria-label="Redo base edit"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={17} />
        </button>
      </header>
      <div className="base-workspace">
        <aside className="base-palette">
          <h2>Buildables</h2>
          <input
            aria-label="Search buildables"
            placeholder="Find a piece…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="base-catalog">
            {buildables
              .filter((b) =>
                b.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={kind === b.id ? "active" : ""}
                  onClick={() => setKind(b.id)}
                >
                  <strong>{b.name}</strong>
                  <small>
                    {b.width.toFixed(1)} × {b.depth.toFixed(1)} ×{" "}
                    {b.height.toFixed(1)} m · {b.cost} supplies
                  </small>
                </button>
              ))}
          </div>
          <button type="button" className="primary" onClick={add}>
            Add {basePiece(kind)?.name}
          </button>
          <label>
            Grid snap
            <select
              value={snap}
              onChange={(e) => setSnap(Number(e.target.value))}
            >
              {[0.25, 0.5, 1, 1.5].map((v) => (
                <option key={v} value={v}>
                  {v} m
                </option>
              ))}
            </select>
          </label>
        </aside>
        <main className="base-canvas">
          {mode === "2d" && (
            <div className="base-canvas-controls">
              <button
                type="button"
                aria-label="Zoom out base"
                onClick={() => setExtent((v) => Math.min(260, v * 1.4))}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Zoom in base"
                onClick={() => setExtent((v) => Math.max(12, v / 1.4))}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtent(130);
                  setCenter({ x: 0, y: 0 });
                }}
              >
                Fit build area
              </button>
              <span>Scroll to zoom · right-drag to pan</span>
            </div>
          )}
          {mode === "3d" ? (
            <Suspense fallback={<p>Opening base preview…</p>}>
              <BasePreview base={shown} />
            </Suspense>
          ) : (
            <svg
              ref={svg}
              viewBox={`${center.x - extent / 2} ${center.y - extent / 2} ${extent} ${extent}`}
              role="application"
              aria-label="Base footprint canvas; drag a piece to move it"
              onContextMenu={(e) => e.preventDefault()}
              onWheel={(e) =>
                setExtent((v) =>
                  Math.max(12, Math.min(260, v * (e.deltaY > 0 ? 1.1 : 0.9))),
                )
              }
              onPointerDown={(e) => {
                if (e.button === 2) {
                  pan.current = { x: e.clientX, y: e.clientY, center };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  return;
                }
                if (e.button !== 0 || !(e.target instanceof Element)) return;
                const id = e.target
                    .closest("[data-piece]")
                    ?.getAttribute("data-piece"),
                  p = base.pieces.find((p) => p.id === id);
                setSelected(p?.id ?? null);
                if (p) {
                  drag.current = { start: position(e), original: p };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
              }}
              onPointerMove={(e) => {
                if (pan.current) {
                  const rect = e.currentTarget.getBoundingClientRect(),
                    scale = extent / Math.min(rect.width, rect.height);
                  setCenter({
                    x:
                      pan.current.center.x -
                      (e.clientX - pan.current.x) * scale,
                    y:
                      pan.current.center.y -
                      (e.clientY - pan.current.y) * scale,
                  });
                  return;
                }
                const d = drag.current;
                if (!d) return;
                const pt = position(e);
                setDraft({
                  ...d.original,
                  x: Math.max(
                    -100,
                    Math.min(100, d.original.x + pt.x - d.start.x),
                  ),
                  y: Math.max(
                    -100,
                    Math.min(100, d.original.y + pt.y - d.start.y),
                  ),
                });
              }}
              onPointerUp={() => {
                if (drag.current && draft) changePiece(draft);
                drag.current = null;
                pan.current = null;
                setDraft(null);
              }}
              onPointerCancel={() => {
                drag.current = null;
                pan.current = null;
                setDraft(null);
              }}
            >
              <defs>
                <pattern
                  id="base-grid"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M5 0H0V5"
                    fill="none"
                    stroke="#2b393d"
                    strokeWidth=".15"
                  />
                </pattern>
              </defs>
              <rect
                x={center.x - extent / 2}
                y={center.y - extent / 2}
                width={extent}
                height={extent}
                fill="url(#base-grid)"
              />
              <path
                d="M-130 0H130M0-130V130"
                stroke="#526568"
                strokeWidth=".2"
              />
              {shown.pieces
                .filter((p) => p.kind === "fob")
                .map((p) => (
                  <rect
                    key={p.id}
                    x={p.x - fobRange}
                    y={-p.y - fobRange}
                    width={fobRange * 2}
                    height={fobRange * 2}
                    fill="#e8bb4808"
                    stroke="#e8bb4870"
                    strokeDasharray="1 1"
                    strokeWidth=".25"
                  />
                ))}
              {shown.pieces.map((p) => (
                <g key={p.id} data-piece={p.id}>
                  <polygon
                    points={footprint(p)
                      .map((v) => `${v.x},${-v.y}`)
                      .join(" ")}
                    fill={p.kind === "fob" ? "#e8bb4870" : "#73b7da60"}
                    stroke={selected === p.id ? "#f4f2e9" : "#73b7da"}
                    strokeWidth={selected === p.id ? 0.3 : 0.15}
                  />
                  <text
                    x={p.x}
                    y={-p.y}
                    textAnchor="middle"
                    fontSize="1.2"
                    fill="#f4f2e9"
                    pointerEvents="none"
                  >
                    {basePiece(p.kind)?.name}
                  </text>
                </g>
              ))}
              <text
                x={center.x + extent * 0.4}
                y={center.y - extent * 0.42}
                fill="#a5cbd2"
                fontSize="2"
              >
                N ↑
              </text>
            </svg>
          )}
          <footer>
            5 m grid · metres from base anchor · dimensions from source bounds,
            not exact collision meshes
          </footer>
        </main>
        <aside className="base-inspector">
          <h2>{spec?.name ?? "Your base"}</h2>
          {piece && spec ? (
            <>
              <p>
                {spec.height.toFixed(2)} m model height · {spec.cost} supplies
              </p>
              {(
                [
                  ["x", "East"],
                  ["y", "North"],
                  ["elevation", "Elevation"],
                  ["rotation", "Rotation"],
                ] satisfies [
                  keyof Pick<BasePiece, "x" | "y" | "elevation" | "rotation">,
                  string,
                ][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    aria-label={`Piece ${label}`}
                    value={piece[key]}
                    step={key === "rotation" ? 15 : snap}
                    min={
                      key === "elevation" ? 0 : key === "rotation" ? -360 : -100
                    }
                    max={
                      key === "elevation" ? 80 : key === "rotation" ? 360 : 100
                    }
                    onChange={(e) =>
                      changePiece({ ...piece, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <div className="base-actions">
                <button
                  type="button"
                  onClick={() =>
                    changePiece({
                      ...piece,
                      rotation: (piece.rotation + 90) % 360,
                    })
                  }
                >
                  <RotateCw size={16} /> Rotate 90°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update({
                      ...base,
                      pieces: base.pieces.filter((p) => p.id !== piece.id),
                    });
                    setSelected(null);
                  }}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </>
          ) : (
            <p>
              Add a piece, then drag it or edit its coordinates. Dashed squares
              show each FOB’s build area, 60 m each way.
            </p>
          )}
          <h2>Map anchor</h2>
          {(["x", "y"] satisfies (keyof Point)[]).map((key) => (
            <label key={key}>
              Game {key.toUpperCase()}
              <input
                aria-label={`Base anchor ${key.toUpperCase()}`}
                type="number"
                min="0"
                max="163.84"
                step=".01"
                value={base.anchor[key]}
                onChange={(e) =>
                  update({
                    ...base,
                    anchor: { ...base.anchor, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={!base.pieces.length}
            onClick={toBoard}
          >
            <MapPin size={16} /> Copy footprints to Board
          </button>
          <h2>
            {base.pieces.length} pieces ·{" "}
            {totals.reduce((sum, b) => sum + b.count * b.cost, 0)} supplies
          </h2>
          <ul className="base-manifest">
            {totals.map((b) => (
              <li key={b.id}>
                {b.count} × {b.name}
                <span>{b.count * b.cost}</span>
              </li>
            ))}
          </ul>
          {baseWarnings(base).map((w) => (
            <p className="base-warning" key={w}>
              {w}
            </p>
          ))}
          <p>
            Model envelopes may overlap without a collision. Ground support,
            doors, stacking and build legality need in-game checks.
          </p>
          <div className="base-actions">
            <button
              type="button"
              onClick={() =>
                download(
                  new Blob([JSON.stringify(base, null, 2)], {
                    type: "application/json",
                  }),
                  "warboard-base.json",
                )
              }
            >
              <Download size={16} /> Export base
            </button>
            <button type="button" onClick={() => input.current?.click()}>
              <Upload size={16} /> Import base
            </button>
          </div>
          <input
            hidden
            aria-label="Import base file"
            ref={input}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          {error && <p role="alert">{error}</p>}
          <p>
            Included in your saved plan and editable exports.{" "}
            <a
              href="https://wardogs.zone/loadouts/base"
              target="_blank"
              rel="noreferrer"
            >
              Buildable source ↗
            </a>
          </p>
        </aside>
      </div>
    </div>
  );
}
