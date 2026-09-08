import { assessPatch, type LandingCandidate, type TerrainGrid } from "./flight";
import type { Point } from "./model";
import { terrainHeights } from "./terrain";
import { loadObstacles, obstacleHeight } from "./obstacles";

export async function findFlatGround(
  map: string,
  center: Point,
  grid: TerrainGrid,
  radius: number,
  maxSlope: number,
  maxRoughness: number,
  accept: (candidate: LandingCandidate) => boolean = () => true,
  searchStep = 30,
) {
  // A bounded 300 m square search. Each footprint is sampled every 2 m,
  // matching the source vertex spacing instead of the coarse display mesh.
  const size = Math.round(radius) + 1,
    step = 2,
    sites: Point[] = [],
    points: Point[] = [];
  for (let y = -150; y <= 150; y += searchStep)
    for (let x = -150; x <= 150; x += searchStep) {
      const p = { x: center.x + x / 100, y: center.y + y / 100 };
      if (
        p.x - radius / 100 < grid.minX ||
        p.x + radius / 100 > grid.maxX ||
        p.y - radius / 100 < grid.minY ||
        p.y + radius / 100 > grid.maxY
      )
        continue;
      sites.push(p);
      for (let row = 0; row < size; row++)
        for (let col = 0; col < size; col++)
          points.push({
            x: p.x + ((col - (size - 1) / 2) * step) / 100,
            y: p.y + ((row - (size - 1) / 2) * step) / 100,
          });
    }
  const heights: number[] = [];
  for (let offset = 0; offset < points.length; offset += 24000)
    heights.push(
      ...(await terrainHeights(map, points.slice(offset, offset + 24000))),
    );
  const candidates: LandingCandidate[] = [];
  const obstacles = await loadObstacles(map);
  sites.forEach((p, i) => {
    const start = i * size * size;
    if (
      points
        .slice(start, start + size * size)
        .some(
          (point, j) =>
            (obstacleHeight(obstacles, point) ?? -Infinity) >
            heights[start + j] + 4,
        )
    )
      return;
    const metrics = assessPatch(
      heights.slice(i * size * size, (i + 1) * size * size),
      size,
      step,
    );
    if (
      metrics.slope <= maxSlope &&
      metrics.roughness <= maxRoughness &&
      accept({ ...p, ...metrics, radius })
    )
      candidates.push({ ...p, ...metrics, radius });
  });
  candidates.sort((a, b) => a.slope - b.slope || a.roughness - b.roughness);
  const spaced: LandingCandidate[] = [];
  for (const c of candidates)
    if (
      spaced.every((p) => Math.hypot(c.x - p.x, c.y - p.y) * 100 > radius * 2)
    ) {
      spaced.push(c);
      if (spaced.length === 5) break;
    }
  return spaced;
}
