import { decodeGzipFile } from "./compressedData";
import { assetUrl } from "./assetUrl";
import type { Point } from "./model";
import metadata from "../public/obstacles/manifest.json";
export type ObstacleGrid = {
  size: number;
  span: number;
  scale: number;
  offset: number;
  surface: Uint16Array;
  canopy: Float32Array;
  roads?: Uint8Array;
  roadSpan?: number;
};
const cache = new Map<string, Promise<ObstacleGrid>>();
export function obstacleHeight(
  grid: ObstacleGrid | undefined,
  p: Point,
  buffer = 0,
): number | null {
  if (!grid || p.x < 0 || p.y < 0 || p.x >= grid.span || p.y >= grid.span)
    return null;
  const { size, span } = grid;
  const x = Math.floor((p.x / span) * size),
    y = Math.min(size - 1, Math.floor((1 - p.y / span) * size));
  const radius = Math.ceil(buffer / ((span * 100) / size));
  let top = -Infinity;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const col = x + dx,
        row = y + dy;
      if (col < 0 || row < 0 || col >= size || row >= size) continue;
      const i = row * size + col;
      top = Math.max(top, grid.surface[i] * grid.scale + grid.offset);
      if (Number.isFinite(grid.canopy[i])) top = Math.max(top, grid.canopy[i]);
    }
  return Number.isFinite(top) ? top : null;
}
export function loadObstacles(map: string): Promise<ObstacleGrid> {
  const key = map.toLowerCase();
  if (key !== "bakurani" && key !== "ozeti")
    return Promise.reject(
      Error("Obstacle data is available for built-in maps only."),
    );
  let job = cache.get(key);
  if (job) return job;
  const m = metadata.maps[key];
  async function read(suffix: string, hash: string, bytes: number) {
    const response = await fetch(assetUrl(`/obstacles/${key}-${suffix}.gz`));
    if (!response.ok || !response.body)
      throw Error("Obstacle data is unavailable. Reconnect and retry.");
    const raw = await decodeGzipFile(await response.arrayBuffer());
    if (raw.byteLength !== bytes)
      throw Error("Obstacle dataset size mismatch.");
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", raw)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== hash)
      throw Error("Obstacle dataset integrity check failed.");
    return raw;
  }
  job = Promise.all([
    read("surface.u16", m.surfaceHash, m.size * m.size * 2),
    read("canopy.f32", m.canopyHash, m.size * m.size * 4),
    read("roads.u8", m.roadHash, m.size * m.size),
  ]).then(([surface, canopy, roads]) => ({
    size: m.size,
    span: m.span,
    scale: m.scale,
    offset: m.offset,
    surface: new Uint16Array(surface),
    canopy: new Float32Array(canopy),
    roads: new Uint8Array(roads),
    roadSpan: m.roadSpan,
  }));
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}

// Source road strokes are a corridor preference, never evidence of obstacle clearance.
export function onRoad(grid: ObstacleGrid | undefined, p: Point): boolean {
  if (
    !grid?.roads ||
    !grid.roadSpan ||
    p.x < 0 ||
    p.y < 0 ||
    p.x >= grid.roadSpan ||
    p.y >= grid.roadSpan
  )
    return false;
  const x = Math.floor((p.x / grid.roadSpan) * grid.size);
  const y = Math.min(
    grid.size - 1,
    Math.floor((1 - p.y / grid.roadSpan) * grid.size),
  );
  return grid.roads[y * grid.size + x] === 1;
}
