import type { Point } from "./model";
import {
  forestAt,
  isForestCover,
  type ForestCover,
  type ForestBounds,
} from "./forest";

export type FlightWaypoint = Point & {
  id: string;
  name: string;
  altitude: number;
};
export type Flight = {
  version: 1;
  mode: "agl" | "absolute";
  waypoints: FlightWaypoint[];
  approach?: LandingApproach;
  treeAreas?: TreeArea[];
  autoTrees?: ForestCover;
  imagery?: "color" | "terrain";
  turns?: "smooth";
  towerBuffer?: number;
};
export type LandingApproach = {
  entryAligned?: boolean;
  descent?: "late";
  type: "direct" | "j-hook" | "s-turn";
  side: "left" | "right";
  size: number;
};
export type TreeArea = {
  kind?: "trees" | "clearing";
  id: string;
  name: string;
  height: number;
  points: Point[];
};
export function validTreeOutline(points: Point[]) {
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0);
  return points.length >= 3 && Math.abs(area) > 0.00001;
}
export const defaultApproach: LandingApproach = {
  type: "j-hook",
  side: "left",
  size: 100,
};
export function isApproach(v: unknown): v is LandingApproach {
  return (
    record(v) &&
    (v.entryAligned === undefined || typeof v.entryAligned === "boolean") &&
    (v.descent === undefined || v.descent === "late") &&
    (v.type === "direct" || v.type === "j-hook" || v.type === "s-turn") &&
    (v.side === "left" || v.side === "right") &&
    typeof v.size === "number" &&
    Number.isFinite(v.size) &&
    v.size >= 25 &&
    v.size <= 500
  );
}
function validTreeAreas(v: unknown) {
  if (!Array.isArray(v) || v.length > 32) return false;
  const ids = new Set<string>();
  return v.every((a: unknown) => {
    if (
      !record(a) ||
      (a.kind !== undefined && a.kind !== "trees" && a.kind !== "clearing") ||
      typeof a.id !== "string" ||
      !/^[\w-]{1,80}$/.test(a.id) ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      a.name.length > 80 ||
      typeof a.height !== "number" ||
      !Number.isFinite(a.height) ||
      a.height < 1 ||
      a.height > 100 ||
      !Array.isArray(a.points) ||
      a.points.length < 3 ||
      a.points.length > 64 ||
      !a.points.every(
        (p: unknown) =>
          record(p) &&
          typeof p.x === "number" &&
          Number.isFinite(p.x) &&
          p.x >= -0.03 &&
          p.x <= 163.84 &&
          typeof p.y === "number" &&
          Number.isFinite(p.y) &&
          p.y >= -0.03 &&
          p.y <= 163.84,
      )
    )
      return false;
    if (!validTreeOutline(a.points)) return false;
    ids.add(a.id);
    return true;
  });
}
export const emptyFlight = (): Flight => ({
  version: 1,
  mode: "agl",
  waypoints: [],
  approach: { ...defaultApproach },
});
export const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";
export function isFlight(v: unknown): v is Flight {
  if (
    !record(v) ||
    v.version !== 1 ||
    (v.turns !== undefined && v.turns !== "smooth") ||
    (v.towerBuffer !== undefined &&
      (typeof v.towerBuffer !== "number" ||
        !Number.isFinite(v.towerBuffer) ||
        v.towerBuffer < 25 ||
        v.towerBuffer > 200)) ||
    (v.imagery !== undefined &&
      v.imagery !== "color" &&
      v.imagery !== "terrain") ||
    (v.mode !== "agl" && v.mode !== "absolute") ||
    !Array.isArray(v.waypoints) ||
    v.waypoints.length > 32 ||
    (v.approach !== undefined && !isApproach(v.approach)) ||
    (v.treeAreas !== undefined && !validTreeAreas(v.treeAreas)) ||
    (v.autoTrees !== undefined && !isForestCover(v.autoTrees))
  )
    return false;
  const ids = new Set<string>();
  return v.waypoints.every((w: unknown) => {
    if (
      !record(w) ||
      typeof w.id !== "string" ||
      !/^[\w-]{1,80}$/.test(w.id) ||
      ids.has(w.id) ||
      typeof w.name !== "string" ||
      w.name.length > 80 ||
      ![w.x, w.y, w.altitude].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ||
      typeof w.x !== "number" ||
      typeof w.y !== "number" ||
      typeof w.altitude !== "number" ||
      w.x < -0.03 ||
      w.x > 163.84 ||
      w.y < -0.03 ||
      w.y > 163.84 ||
      w.altitude < (v.mode === "agl" ? 0 : -2000) ||
      w.altitude > 5000
    )
      return false;
    ids.add(w.id);
    return true;
  });
}
export type TerrainGrid = {
  version: 1;
  size: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  heights: number[];
};
export function isTerrainGrid(v: unknown): v is TerrainGrid {
  return (
    record(v) &&
    v.version === 1 &&
    typeof v.size === "number" &&
    Number.isInteger(v.size) &&
    v.size >= 2 &&
    v.size <= 513 &&
    [v.minX, v.maxX, v.minY, v.maxY].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) &&
    typeof v.minX === "number" &&
    typeof v.maxX === "number" &&
    v.maxX > v.minX &&
    typeof v.minY === "number" &&
    typeof v.maxY === "number" &&
    v.maxY > v.minY &&
    Array.isArray(v.heights) &&
    v.heights.length === v.size * v.size &&
    v.heights.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
export function gridHeight(g: TerrainGrid, p: Point): number | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  if (p.x < g.minX || p.x > g.maxX || p.y < g.minY || p.y > g.maxY) return null;
  const x = ((p.x - g.minX) / (g.maxX - g.minX)) * (g.size - 1),
    y = ((g.maxY - p.y) / (g.maxY - g.minY)) * (g.size - 1);
  const x0 = Math.min(g.size - 2, Math.floor(x)),
    y0 = Math.min(g.size - 2, Math.floor(y)),
    tx = x - x0,
    ty = y - y0;
  const a = g.heights[y0 * g.size + x0],
    b = g.heights[y0 * g.size + x0 + 1],
    c = g.heights[(y0 + 1) * g.size + x0],
    d = g.heights[(y0 + 1) * g.size + x0 + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
export type RouteSample = Point & {
  distance: number;
  leg: number;
  t: number;
  ground: number;
};
// Curves change only the final leg. Earlier corridor waypoints remain exact.
// Turn size is a geometric handle length, not an aircraft turn-radius model.
export function approachVertices(
  points: Point[],
  approach?: LandingApproach,
): Point[] {
  const a = points.at(-2),
    b = points.at(-1);
  if (!a || !b || !approach || approach.type === "direct")
    return a && b ? [a, b] : [];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.001) return [a, b];
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const side = approach.side === "left" ? 1 : -1;
  const n = { x: -u.y * side, y: u.x * side };
  const r = approach.size / 100;
  const before = points.at(-3);
  const incomingLength = before
    ? Math.hypot(a.x - before.x, a.y - before.y)
    : 0;
  const incoming =
    before && incomingLength > 0.001
      ? {
          x: (a.x - before.x) / incomingLength,
          y: (a.y - before.y) / incomingLength,
        }
      : u;
  const c1 =
    approach.type === "j-hook"
      ? {
          x: a.x + (incoming.x * length) / 2,
          y: a.y + (incoming.y * length) / 2,
        }
      : {
          x: a.x + (u.x * length) / 3 + n.x * r,
          y: a.y + (u.y * length) / 3 + n.y * r,
        };
  const exitDirection = approach.entryAligned ? incoming : u;
  const exitNormal = { x: -exitDirection.y * side, y: exitDirection.x * side };
  const c2 =
    approach.type === "j-hook"
      ? {
          x: b.x + exitDirection.x * r * 2 + exitNormal.x * r * 2,
          y: b.y + exitDirection.y * r * 2 + exitNormal.y * r * 2,
        }
      : {
          x: b.x - (u.x * length) / 3 - n.x * r,
          y: b.y - (u.y * length) / 3 - n.y * r,
        };
  return Array.from({ length: 129 }, (_, i) => {
    const t = i / 128,
      q = 1 - t;
    return {
      x:
        q * q * q * a.x +
        3 * q * q * t * c1.x +
        3 * q * t * t * c2.x +
        t * t * t * b.x,
      y:
        q * q * q * a.y +
        3 * q * q * t * c1.y +
        3 * q * t * t * c2.y +
        t * t * t * b.y,
    };
  });
}
export function routeLocations(
  points: Point[],
  approach?: LandingApproach,
  smooth = false,
): Omit<RouteSample, "ground">[] {
  const result: Omit<RouteSample, "ground">[] = [];
  const legs = points
    .slice(1)
    .map((b, i) =>
      i === points.length - 2 && approach && approach.type !== "direct"
        ? approachVertices(points, approach)
        : smooth
          ? curvedLeg(points, i)
          : [points[i], b],
    );
  const lengthOf = (a: Point, b: Point) =>
    Math.hypot(b.x - a.x, b.y - a.y) * 100;
  const lengths = legs.map((vertices) =>
    vertices.slice(1).reduce((sum, b, i) => sum + lengthOf(vertices[i], b), 0),
  );
  const spacing = Math.max(10, lengths.reduce((a, b) => a + b, 0) / 6000);
  let distance = 0;
  legs.forEach((vertices, leg) => {
    let along = 0;
    vertices.slice(1).forEach((b, j) => {
      const a = vertices[j],
        length = lengthOf(a, b),
        steps = Math.max(1, Math.ceil(length / spacing));
      for (let i = result.length === 0 ? 0 : 1; i <= steps; i++) {
        const fraction = i / steps;
        result.push({
          x: a.x + (b.x - a.x) * fraction,
          y: a.y + (b.y - a.y) * fraction,
          distance: distance + along + length * fraction,
          leg,
          t:
            lengths[leg] > 0
              ? (along + length * fraction) / lengths[leg]
              : fraction,
        });
      }
      along += length;
    });
    distance += lengths[leg];
  });
  return result;
}
// Bounded cubic handles preserve every editable waypoint and share tangent
// directions across legs. Generated curves are checked again after smoothing.
export function curvedLeg(points: Point[], i: number): Point[] {
  const a = points[i],
    b = points[i + 1];
  const before = points[i - 1] ?? a,
    after = points[i + 2] ?? b;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const handle = (from: Point, to: Point, at: Point, sign: number) => {
    const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return {
      x: at.x + (((sign * (to.x - from.x)) / d) * length) / 3,
      y: at.y + (((sign * (to.y - from.y)) / d) * length) / 3,
    };
  };
  const c = handle(before, b, a, 1),
    d = handle(a, after, b, -1);
  return Array.from({ length: 33 }, (_, j) => {
    const t = j / 32,
      q = 1 - t;
    return {
      x:
        q * q * q * a.x +
        3 * q * q * t * c.x +
        3 * q * t * t * d.x +
        t * t * t * b.x,
      y:
        q * q * q * a.y +
        3 * q * q * t * c.y +
        3 * q * t * t * d.y +
        t * t * t * b.y,
    };
  });
}
// Include polygon boundaries and a small horizontal buffer for the route centerline.
export function canopyAt(
  point: Point,
  areas: TreeArea[],
  buffer = 10,
  kind: "trees" | "clearing" = "trees",
): number {
  let canopy = 0;
  for (const area of areas) {
    if ((area.kind ?? "trees") !== kind) continue;
    let inside = false,
      near = false;
    for (
      let i = 0, j = area.points.length - 1;
      i < area.points.length;
      j = i++
    ) {
      const a = area.points[j],
        b = area.points[i];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        den = dx * dx + dy * dy;
      const t = den
        ? Math.max(
            0,
            Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / den),
          )
        : 0;
      if (
        Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) * 100 <=
        buffer
      )
        near = true;
    }
    if (inside || near) canopy = Math.max(canopy, area.height);
  }
  return canopy;
}
export function altitudeFraction(
  flight: Flight,
  sample: Pick<RouteSample, "leg" | "t">,
) {
  return flight.approach?.descent === "late" &&
    sample.leg === flight.waypoints.length - 2
    ? sample.t ** 3
    : sample.t;
}
export function routeAltitudes(flight: Flight, samples: RouteSample[]) {
  return samples.map((s) => {
    const a = flight.waypoints[s.leg],
      b = flight.waypoints[s.leg + 1];
    const requested =
      a.altitude + (b.altitude - a.altitude) * altitudeFraction(flight, s);
    return {
      ...s,
      altitude: requested + (flight.mode === "agl" ? s.ground : 0),
    };
  });
}
export type LandingCandidate = Point & {
  slope: number;
  roughness: number;
  relief: number;
  radius: number;
};
// Least-squares plane over a symmetric square footprint. Roughness is the
// maximum vertical residual, so an isolated bump is not averaged away.
export function assessPatch(heights: number[], size: number, spacing: number) {
  if (
    size < 3 ||
    size % 2 === 0 ||
    heights.length !== size * size ||
    !heights.every(Number.isFinite) ||
    spacing <= 0
  )
    throw new Error("Invalid terrain patch.");
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length,
    half = (size - 1) / 2;
  let xx = 0,
    yy = 0,
    xz = 0,
    yz = 0;
  heights.forEach((h, i) => {
    const x = ((i % size) - half) * spacing,
      y = (Math.floor(i / size) - half) * spacing;
    xx += x * x;
    yy += y * y;
    xz += x * (h - mean);
    yz += y * (h - mean);
  });
  const a = xz / xx,
    b = yz / yy;
  const roughness = Math.max(
    ...heights.map((h, i) =>
      Math.abs(
        h -
          (mean +
            a * ((i % size) - half) * spacing +
            b * (Math.floor(i / size) - half) * spacing),
      ),
    ),
  );
  return {
    slope: (Math.atan(Math.hypot(a, b)) * 180) / Math.PI,
    roughness,
    relief: Math.max(...heights) - Math.min(...heights),
  };
}

export function coverHeight(
  p: Point,
  flight: Flight,
  bounds: ForestBounds,
  buffer = 10,
) {
  const areas = flight.treeAreas ?? [];
  const manual = canopyAt(p, areas, buffer);
  const hasClearings = areas.some((a) => a.kind === "clearing");
  return Math.max(
    manual,
    forestAt(
      p,
      flight.autoTrees,
      bounds,
      buffer,
      hasClearings
        ? (cell) => canopyAt(cell, areas, 0, "clearing") > 0
        : undefined,
    ),
  );
}
