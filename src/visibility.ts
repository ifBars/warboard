import { MAX_CANOPY_HEIGHT, type ObstacleGrid } from "./obstacles";
import type { Point } from "./model";

// Game coordinates are hundreds of metres, north-up. Samplers return absolute
// elevations in metres, or null outside the dataset.
export type SurfaceSample = { surface: number; canopy: number | null };
export type Sampler = (p: Point) => SurfaceSample | null;

export function gridSampler(grid: ObstacleGrid): Sampler {
  return (p) => {
    if (p.x < 0 || p.y < 0 || p.x >= grid.span || p.y >= grid.span) return null;
    const col = Math.floor((p.x / grid.span) * grid.size),
      row = Math.min(
        grid.size - 1,
        Math.floor((1 - p.y / grid.span) * grid.size),
      );
    const i = row * grid.size + col,
      canopy = grid.canopy[i],
      surface = grid.surface[i] * grid.scale + grid.offset;
    return {
      surface,
      canopy:
        Number.isFinite(canopy) && canopy - surface <= MAX_CANOPY_HEIGHT
          ? canopy
          : null,
    };
  };
}

export type SightOptions = {
  observerHeight: number;
  targetHeight: number;
  trees: boolean;
  /** Ground elevation at each end when a finer terrain source is available. */
  observerGround?: number;
  targetGround?: number;
  /** Metres near each end ignored, so an endpoint's own cell cannot block it. */
  endClearance?: number;
};
// Two 8 m cells plus alignment error; canopy envelopes are conservative, so a
// tree beside a position counts as that position's own cover, not a blocker.
const END_CLEARANCE = 16,
  CANOPY_CLEARANCE = 25,
  TOLERANCE = 0.5;
export type SightResult = {
  distance: number;
  eye: number;
  aim: number;
  clear: boolean;
  blocker: { distance: number; point: Point; kind: "surface" | "trees" } | null;
  /** Smallest gap between the sight line and anything checked, in metres. */
  margin: number;
  profile: { distance: number; surface: number; canopy: number | null }[];
};

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function sightLine(
  sample: Sampler,
  a: Point,
  b: Point,
  options: SightOptions,
): SightResult | null {
  const distance = Math.hypot(b.x - a.x, b.y - a.y) * 100;
  const start = sample(a),
    end = sample(b);
  if (!start || !end || !Number.isFinite(distance)) return null;
  const eye =
      (options.observerGround ?? start.surface) + options.observerHeight,
    aim = (options.targetGround ?? end.surface) + options.targetHeight;
  const skip = options.endClearance ?? END_CLEARANCE;
  const steps = Math.max(2, Math.min(4000, Math.ceil(distance / 2)));
  const profile: SightResult["profile"] = [];
  let blocker: SightResult["blocker"] = null,
    margin = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      d = distance * t,
      p = lerp(a, b, t),
      s = sample(p);
    if (!s) return null;
    profile.push({ distance: d, surface: s.surface, canopy: s.canopy });
    if (d < skip || distance - d < skip) continue;
    const line = eye + (aim - eye) * t;
    const canopy =
      options.trees &&
      s.canopy !== null &&
      d >= CANOPY_CLEARANCE &&
      distance - d >= CANOPY_CLEARANCE
        ? s.canopy
        : -Infinity;
    const top = Math.max(s.surface, canopy);
    margin = Math.min(margin, line - top);
    if (!blocker && top > line + TOLERANCE)
      blocker = {
        distance: d,
        point: p,
        kind: s.surface > line + TOLERANCE ? "surface" : "trees",
      };
  }
  // Charts need a bounded number of points; the check above used every sample.
  const stride = Math.ceil(profile.length / 160);
  return {
    distance,
    eye,
    aim,
    clear: !blocker,
    blocker,
    margin: Number.isFinite(margin) ? margin : 0,
    profile: profile.filter(
      (_, i) => i % stride === 0 || i === profile.length - 1,
    ),
  };
}

export type CoverageOptions = {
  observerHeight: number;
  targetHeight: number;
  trees: boolean;
  observerGround?: number;
  /** Radial step in metres; the obstacle grid is about 8 m per cell. */
  step?: number;
};
export type Coverage = {
  rays: number;
  steps: number;
  step: number;
  radius: number;
  /**
   * rays × steps, index ray * steps + step: 1 clear, 3 seen only through tree
   * canopy, 0 blocked by terrain or structures, 2 outside data.
   */
  cells: Uint8Array;
  visibleShare: number;
  treeShare: number;
};

// Radial sweep: along each bearing keep the steepest obstruction seen so far.
// A target is visible when the slope to its top is at least that steep. Solid
// ground/structures and tree canopy are tracked separately, because canopy
// thins sight rather than stopping it.
export function coverage(
  sample: Sampler,
  center: Point,
  radius: number,
  options: CoverageOptions,
): Coverage | null {
  const origin = sample(center);
  if (!origin || !(radius > 0) || radius > 5000) return null;
  const step = options.step ?? 6;
  const steps = Math.max(1, Math.ceil(radius / step));
  const rays = Math.max(
    360,
    Math.min(3600, Math.ceil((2 * Math.PI * radius) / step)),
  );
  const eye =
    (options.observerGround ?? origin.surface) + options.observerHeight;
  const cells = new Uint8Array(rays * steps);
  let visible = 0,
    screened = 0,
    known = 0;
  for (let r = 0; r < rays; r++) {
    const angle = (r / rays) * Math.PI * 2,
      dx = Math.sin(angle) / 100,
      dy = Math.cos(angle) / 100;
    let solid = -Infinity,
      leafy = -Infinity,
      outside = false;
    for (let j = 0; j < steps; j++) {
      const index = r * steps + j,
        d = (j + 1) * step;
      const s = outside
        ? null
        : sample({ x: center.x + dx * d, y: center.y + dy * d });
      if (!s) {
        outside = true;
        cells[index] = 2;
        continue;
      }
      const slope = (s.surface + options.targetHeight - eye) / d;
      const state =
        d < END_CLEARANCE || (slope >= solid && slope >= leafy)
          ? 1
          : slope >= solid
            ? options.trees
              ? 3
              : 1
            : 0;
      cells[index] = state;
      known++;
      if (state === 1) visible++;
      else if (state === 3) screened++;
      if (d >= END_CLEARANCE)
        solid = Math.max(solid, (s.surface - TOLERANCE - eye) / d);
      if (d >= CANOPY_CLEARANCE && s.canopy !== null)
        leafy = Math.max(leafy, (s.canopy - TOLERANCE - eye) / d);
    }
  }
  return {
    rays,
    steps,
    step,
    radius,
    cells,
    visibleShare: known ? visible / known : 0,
    treeShare: known ? screened / known : 0,
  };
}

/** Cell state at an offset in metres east/north of the observer, or null beyond range. */
export function coverageAt(c: Coverage, east: number, north: number) {
  const d = Math.hypot(east, north);
  if (d > c.radius) return null;
  const j = Math.min(c.steps - 1, Math.max(0, Math.round(d / c.step) - 1));
  if (d < c.step) return 1;
  const angle = (Math.atan2(east, north) + Math.PI * 2) % (Math.PI * 2);
  const r = Math.round((angle / (Math.PI * 2)) * c.rays) % c.rays;
  return c.cells[r * c.steps + j];
}
