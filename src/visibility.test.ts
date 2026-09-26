import { describe, expect, test } from "bun:test";
import type { ObstacleGrid } from "./obstacles";
import {
  coverage,
  coverageAt,
  gridSampler,
  sightLine,
  type Sampler,
} from "./visibility";

const flat: Sampler = (p) =>
  p.x < 0 || p.y < 0 || p.x > 100 || p.y > 100
    ? null
    : { surface: 100, canopy: null };
// A 30 m wall running north-south at x = 50 (5 km east of the origin).
const wall: Sampler = (p) =>
  p.x < 0 || p.y < 0 || p.x > 100 || p.y > 100
    ? null
    : { surface: Math.abs(p.x - 50) < 0.05 ? 130 : 100, canopy: null };
const forest: Sampler = (p) =>
  p.x < 0 || p.y < 0 || p.x > 100 || p.y > 100
    ? null
    : { surface: 100, canopy: Math.abs(p.x - 50) < 0.05 ? 115 : null };
const options = { observerHeight: 2, targetHeight: 2, trees: true };

describe("line of sight", () => {
  test("flat ground is clear", () => {
    const r = sightLine(flat, { x: 45, y: 50 }, { x: 55, y: 50 }, options)!;
    expect(r.clear).toBe(true);
    expect(r.distance).toBeCloseTo(1000);
    expect(r.margin).toBeCloseTo(2);
    expect(r.profile.length).toBeLessThanOrEqual(162);
  });
  test("a wall blocks and reports where", () => {
    const r = sightLine(wall, { x: 45, y: 50 }, { x: 55, y: 50 }, options)!;
    expect(r.clear).toBe(false);
    expect(r.blocker?.kind).toBe("surface");
    expect(r.blocker!.distance).toBeGreaterThan(490);
    expect(r.blocker!.distance).toBeLessThan(500);
  });
  test("high observers see over the wall", () => {
    const r = sightLine(
      wall,
      { x: 45, y: 50 },
      { x: 55, y: 50 },
      {
        ...options,
        observerHeight: 80,
        targetHeight: 0,
      },
    )!;
    expect(r.clear).toBe(true);
  });
  test("tree canopy only blocks when included", () => {
    const a = { x: 45, y: 50 },
      b = { x: 55, y: 50 };
    expect(sightLine(forest, a, b, options)!.blocker?.kind).toBe("trees");
    expect(sightLine(forest, a, b, { ...options, trees: false })!.clear).toBe(
      true,
    );
  });
  test("finer endpoint ground overrides coarse cells", () => {
    const r = sightLine(
      flat,
      { x: 45, y: 50 },
      { x: 55, y: 50 },
      {
        ...options,
        observerGround: 90,
        targetGround: 110,
      },
    )!;
    expect(r.eye).toBe(92);
    expect(r.aim).toBe(112);
  });
  test("outside the dataset is unknown", () => {
    expect(
      sightLine(flat, { x: 95, y: 50 }, { x: 105, y: 50 }, options),
    ).toBeNull();
  });
});

describe("coverage", () => {
  test("flat ground is fully visible", () => {
    const c = coverage(flat, { x: 50, y: 50 }, 500, options)!;
    expect(c.visibleShare).toBe(1);
    expect(coverageAt(c, 300, 300)).toBe(1);
    expect(coverageAt(c, 400, 400)).toBeNull();
  });
  test("a wall shades ground behind it but not air above it", () => {
    const c = coverage(wall, { x: 45, y: 50 }, 1000, options)!;
    expect(coverageAt(c, 300, 0)).toBe(1);
    expect(coverageAt(c, 800, 0)).toBe(0);
    expect(coverageAt(c, -800, 0)).toBe(1);
    expect(c.visibleShare).toBeGreaterThan(0.5);
    expect(c.visibleShare).toBeLessThan(1);
    const air = coverage(wall, { x: 45, y: 50 }, 1000, {
      ...options,
      targetHeight: 200,
    })!;
    expect(coverageAt(air, 800, 0)).toBe(1);
  });
  test("tree canopy screens rather than blocks", () => {
    const c = coverage(forest, { x: 45, y: 50 }, 1000, options)!;
    expect(coverageAt(c, 300, 0)).toBe(1);
    expect(coverageAt(c, 800, 0)).toBe(3);
    expect(c.treeShare).toBeGreaterThan(0);
    const bare = coverage(forest, { x: 45, y: 50 }, 1000, {
      ...options,
      trees: false,
    })!;
    expect(coverageAt(bare, 800, 0)).toBe(1);
    // Behind a wall stays blocked even when the wall is also wooded.
    const walled = coverage(wall, { x: 45, y: 50 }, 1000, options)!;
    expect(coverageAt(walled, 800, 0)).toBe(0);
  });
  test("cells beyond the dataset are marked outside", () => {
    const c = coverage(flat, { x: 98, y: 50 }, 500, options)!;
    expect(coverageAt(c, 400, 0)).toBe(2);
    expect(coverageAt(c, -400, 0)).toBe(1);
  });
  test("rejects invalid radii", () => {
    expect(coverage(flat, { x: 50, y: 50 }, 0, options)).toBeNull();
    expect(coverage(flat, { x: 50, y: 50 }, 6000, options)).toBeNull();
  });
});

test("grid sampler decodes surface and canopy north-up", () => {
  const grid: ObstacleGrid = {
    size: 2,
    span: 2,
    scale: 0.5,
    offset: 10,
    surface: new Uint16Array([0, 2, 4, 6]),
    canopy: new Float32Array([NaN, 30, NaN, NaN]),
  };
  const sample = gridSampler(grid);
  // Row 0 is north (high y).
  expect(sample({ x: 1.5, y: 1.5 })).toEqual({ surface: 11, canopy: 30 });
  expect(sample({ x: 0.5, y: 0.5 })).toEqual({ surface: 12, canopy: null });
  expect(sample({ x: 2, y: 0 })).toBeNull();
  // Canopy envelopes far above the surface are artefacts and are ignored.
  grid.canopy[1] = 500;
  expect(sample({ x: 1.5, y: 1.5 })).toEqual({ surface: 11, canopy: null });
});
