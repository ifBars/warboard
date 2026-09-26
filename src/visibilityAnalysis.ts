import { mapData, toGame } from "./cartography";
import type { Mark, Plan, Point } from "./model";
import { loadObstacles } from "./obstacles";
import { terrainHeights } from "./terrain";
import {
  coverage,
  coverageAt,
  gridSampler,
  sightLine,
  type Coverage,
  type SightResult,
} from "./visibility";

export type VisibilitySettings = {
  observerHeight: number;
  targetHeight: number;
  trees: boolean;
};
export const defaultVisibility: VisibilitySettings = {
  observerHeight: 1.8,
  targetHeight: 1.8,
  trees: true,
};
export const targetPresets = [
  { label: "Infantry", height: 1.8 },
  { label: "Vehicle", height: 3 },
  { label: "Low helicopter", height: 30 },
  { label: "Helicopter", height: 100 },
  { label: "High aircraft", height: 300 },
] as const;
export type Analysis =
  | {
      kind: "sight";
      markId: string;
      key: string;
      settings: VisibilitySettings;
      result: SightResult;
    }
  | {
      kind: "coverage";
      markId: string;
      key: string;
      settings: VisibilitySettings;
      image: string;
      visibleShare: number;
      treeShare: number;
      radius: number;
    };

export const geometryKey = (m: Mark) =>
  m.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(";");
export const MAX_COVERAGE_RADIUS = 3000;

function metersPerPixel(map: Plan["map"]) {
  const data = mapData(map);
  return data
    ? ((data.tileBounds.maxX - data.tileBounds.minX) * 100) / map.width
    : null;
}
async function groundAt(map: string, points: Point[]) {
  try {
    return await terrainHeights(map, points);
  } catch {
    // The obstacle surface still supplies coarser ground heights.
    return points.map(() => undefined);
  }
}

export async function runSight(
  plan: Plan,
  mark: Mark,
  settings: VisibilitySettings,
): Promise<Analysis> {
  const a = toGame(mark.points[0], plan.map),
    b = toGame(mark.points[mark.points.length - 1], plan.map);
  if (!a || !b) throw Error("Line of sight needs Bakurani or Ozeti.");
  const [grid, [observerGround, targetGround]] = await Promise.all([
    loadObstacles(plan.map.name),
    groundAt(plan.map.name, [a, b]),
  ]);
  const result = sightLine(gridSampler(grid), a, b, {
    ...settings,
    observerGround,
    targetGround,
  });
  if (!result)
    throw Error("Part of this line is outside the terrain and obstacle data.");
  return { kind: "sight", markId: mark.id, key: geometryKey(mark), settings, result };
}

export async function runCoverage(
  plan: Plan,
  mark: Mark,
  settings: VisibilitySettings,
): Promise<Analysis> {
  const center = toGame(mark.points[0], plan.map),
    scale = metersPerPixel(plan.map);
  if (!center || !scale) throw Error("Coverage needs Bakurani or Ozeti.");
  const last = mark.points[mark.points.length - 1];
  const radius =
    Math.hypot(last.x - mark.points[0].x, last.y - mark.points[0].y) * scale;
  if (radius < 20) throw Error("Draw a larger area to check coverage.");
  if (radius > MAX_COVERAGE_RADIUS)
    throw Error(
      `Coverage checks are limited to a ${MAX_COVERAGE_RADIUS / 1000} km radius. Draw a smaller area.`,
    );
  const [grid, [observerGround]] = await Promise.all([
    loadObstacles(plan.map.name),
    groundAt(plan.map.name, [center]),
  ]);
  const result = coverage(gridSampler(grid), center, radius, {
    ...settings,
    observerGround,
  });
  if (!result) throw Error("The area centre is outside the obstacle data.");
  return {
    kind: "coverage",
    markId: mark.id,
    key: geometryKey(mark),
    settings,
    image: coverageImage(result, Math.min(1024, Math.ceil(radius / 3))),
    visibleShare: result.visibleShare,
    treeShare: result.treeShare,
    radius,
  };
}

const VISIBLE = [143, 212, 138, 110],
  SCREENED = [226, 196, 92, 105],
  HIDDEN = [16, 20, 22, 150];
/** RGBA raster of a coverage result, north-up, covering the circle's square. */
export function coverageRaster(c: Coverage, size: number) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const east = (((col + 0.5) / size) * 2 - 1) * c.radius,
        north = (1 - ((row + 0.5) / size) * 2) * c.radius;
      const state = coverageAt(c, east, north);
      if (state === null || state === 2) continue;
      data.set(
        state === 1 ? VISIBLE : state === 3 ? SCREENED : HIDDEN,
        (row * size + col) * 4,
      );
    }
  return data;
}
function coverageImage(c: Coverage, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Could not draw coverage in this browser.");
  context.putImageData(new ImageData(coverageRaster(c, size), size, size), 0, 0);
  return canvas.toDataURL("image/png");
}
