import data from "./data/weapons.json";
import type { Point } from "./model";

export type WeaponId = "mortar" | "spg";
export type Mission = {
  weapon: WeaponId;
  gun: Point | null;
  target: Point | null;
  targets: { id: string; name: string; point: Point }[];
};
export const emptyMission = (): Mission => ({
  weapon: "mortar",
  gun: null,
  target: null,
  targets: [],
});
export const profiles = data.weapons.map((w) => ({
  id: w.id as WeaponId,
  name: w.names.en,
  min: w.minRangeKm * 1000,
  max: w.maxRangeKm * 1000,
  minMil: w.minElevationMil,
  maxMil: w.maxElevationMil,
  tables: w.ballistics as {
    single?: number[][];
    low?: number[][];
    high?: number[][];
  },
}));

export function rangeBearing(gun: Point, target: Point) {
  const dx = target.x - gun.x,
    dy = target.y - gun.y;
  const meters = Math.hypot(dx, dy) * 100;
  return {
    meters,
    bearing:
      meters < 0.001
        ? null
        : ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
  };
}

// Adapted from Apollyon's MIT-licensed weapons.js. Preserve multiple measured
// elevations at an exact range and use the nearest branch between samples.
export function interpolate(
  table: number[][],
  distance: number,
): [number, number] | null {
  if (!Number.isFinite(distance)) return null;
  const groups: { range: number; mils: number[] }[] = [];
  for (const [range, mil] of [...table].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  )) {
    const prev = groups.at(-1);
    if (prev?.range === range) prev.mils.push(mil);
    else groups.push({ range, mils: [mil] });
  }
  const exact = groups.find((g) => Math.abs(g.range - distance) < 1e-6);
  if (exact) return [Math.min(...exact.mils), Math.max(...exact.mils)];
  const index = groups.findIndex(
    (g, i) => i > 0 && distance > groups[i - 1].range && distance < g.range,
  );
  if (index < 1) return null;
  const left = groups[index - 1],
    right = groups[index];
  const closest = (values: number[], target: number) =>
    values.reduce((a, b) =>
      Math.abs(b - target) < Math.abs(a - target) ? b : a,
    );
  const a = closest(
    left.mils,
    right.mils.reduce((a, b) => a + b, 0) / right.mils.length,
  );
  const b = closest(right.mils, a);
  const mil =
    a + ((distance - left.range) / (right.range - left.range)) * (b - a);
  return [mil, mil];
}

export function firingSolution(weapon: WeaponId, distance: number) {
  const profile = profiles.find((w) => w.id === weapon)!;
  if (
    !Number.isFinite(distance) ||
    distance < profile.min - 1e-6 ||
    distance > profile.max + 1e-6
  )
    return [];
  return Object.entries(profile.tables).flatMap(([arc, table]) => {
    const result = interpolate(table, distance);
    return result && result[1] >= profile.minMil && result[0] <= profile.maxMil
      ? [
          {
            arc,
            mil: [
              Math.max(result[0], profile.minMil),
              Math.min(result[1], profile.maxMil),
            ] as [number, number],
          },
        ]
      : [];
  });
}

export const formatMil = (mil: [number, number]) =>
  Math.abs(mil[0] - mil[1]) < 0.5
    ? `${Math.round(mil[0])}`
    : `${Math.round(mil[0])}–${Math.round(mil[1])}`;
export const coordinateText = (p: Point) =>
  `X ${p.x.toFixed(2)}, Y ${p.y.toFixed(2)}`;
export function parseCoordinates(text: string): Point | null {
  const labelled = text.match(
    /^\s*x\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,; ]+\s*y\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*$/i,
  );
  const plain = text.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[,; ]+\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
  const m = labelled ?? plain;
  if (!m) return null;
  const p = { x: Number(m[1]), y: Number(m[2]) };
  return [p.x, p.y].every(
    (n) => Number.isFinite(n) && n >= -0.03 && n <= 163.84,
  )
    ? p
    : null;
}

// Spotter observations are relative to gun -> target: positive = over / right.
// Offset the aim point opposite the observed miss, without moving the target.
export function correctedAim(
  gun: Point,
  target: Point,
  over: number,
  right: number,
): Point {
  const dx = target.x - gun.x,
    dy = target.y - gun.y,
    length = Math.hypot(dx, dy);
  if (!length || !Number.isFinite(over) || !Number.isFinite(right))
    return target;
  return {
    x: target.x - ((dx / length) * over + (dy / length) * right) / 100,
    y: target.y - ((dy / length) * over - (dx / length) * right) / 100,
  };
}
