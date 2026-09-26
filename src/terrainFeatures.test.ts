import { describe, expect, test } from "bun:test";
import type { ObstacleGrid } from "./obstacles";
import { extractFeatures, opening, structureMask } from "./terrainFeatures";

const size = 32;
const field = (height: (col: number, row: number) => number) => {
  const out = new Float32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) out[row * size + col] = height(col, row);
  return out;
};
// A 3 x 2 cell, 6 m building on a 5 % slope, and a smooth 6 m ridge.
const slope = (col: number) => 100 + col * 0.4;
const building = (col: number, row: number) =>
  col >= 5 && col < 8 && row >= 5 && row < 7 ? 6 : 0;
const ridge = (col: number, row: number) =>
  Math.max(
    0,
    6 - Math.abs(col - 20) * 1.2 - Math.max(0, Math.abs(row - 23) - 3) * 1.2,
  );

describe("terrain features", () => {
  test("opening keeps planar slopes and removes narrow raised features", () => {
    const surface = field((c, r) => slope(c) + building(c, r));
    const ground = opening(surface, size, 4);
    for (let row = 6; row < 26; row++)
      for (let col = 6; col < 26; col++)
        expect(ground[row * size + col]).toBeCloseTo(slope(col), 4);
  });
  test("wall-like blobs are structures; gentle ridges are ground", () => {
    const surface = field((c, r) => slope(c) + building(c, r) + ridge(c, r));
    const mask = structureMask(surface, opening(surface, size, 4), size);
    expect(mask[5 * size + 6]).toBe(1);
    expect(mask[22 * size + 20]).toBe(0);
    expect(mask.reduce((n, v) => n + v, 0)).toBe(6);
  });
  test("extracts merged buildings, trees and bare ground", () => {
    const surface = field((c, r) => slope(c) + building(c, r));
    const scale = 0.01,
      offset = 90;
    const grid: ObstacleGrid = {
      size,
      span: 2.56,
      scale,
      offset,
      surface: Uint16Array.from(surface, (h) => Math.round((h - offset) / scale)),
      canopy: field((c, r) => (c === 20 && r === 20 ? slope(20) + 18 : NaN)),
    };
    const f = extractFeatures(grid, { groundSize: 16 });
    expect(f.cellMeters).toBeCloseTo(8);
    // Two rows of one merged three-cell box each.
    expect(f.buildings.length / 5).toBe(2);
    expect(f.buildings[3]).toBeCloseTo(6, 1);
    expect(f.buildings[4]).toBeCloseTo(24);
    expect(f.trees.length / 4).toBe(1);
    expect(f.trees[3]).toBeCloseTo(18, 1);
    // The building no longer lifts the ground under it.
    const g = f.ground[2 * 16 + 3];
    expect(g).toBeLessThan(slope(7) + 0.5);
    expect(() => extractFeatures(grid, { groundSize: 5 })).toThrow();
  });
});
