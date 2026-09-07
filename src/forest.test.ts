import { validatePlan } from "./model";
import { expect, test } from "bun:test";
import {
  detectForest,
  encodeMask,
  forestAt,
  forestMask,
  isForestCover,
  type ForestCover,
} from "./forest";
import { coverHeight, emptyFlight, isFlight } from "./flight";
function cover(runs: number[]): ForestCover {
  return {
    version: 1,
    source: "wardogs-zone-color-v1",
    map: "Bakurani",
    size: 2048,
    sensitivity: "balanced",
    enabled: true,
    height: 25,
    runs,
    cells: runs.filter((_, i) => i % 2).reduce((a, b) => a + b, 0),
    patches: 1,
  };
}
test("detection distinguishes dense warm canopy from grass, snow and bright fields", () => {
  const size = 80,
    rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let color = [175, 185, 60, 255];
      if (x >= 10 && x < 35 && y >= 10 && y < 65) color = [150, 125, 45, 255];
      if (x >= 45 && y < 25) color = [250, 213, 97, 255];
      if (x >= 45 && y >= 50) color = [240, 240, 240, 255];
      rgba.set(color, (y * size + x) * 4);
    }
  const result = detectForest(rgba, size, size, "balanced");
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < result.runs.length; i += 2)
    mask.fill(1, result.runs[i], result.runs[i] + result.runs[i + 1]);
  expect(mask[30 * size + 20]).toBe(1);
  expect(mask[30 * size + 60]).toBe(0);
  expect(mask[10 * size + 60]).toBe(0);
  expect(mask[60 * size + 60]).toBe(0);
  expect(result.patches).toBe(1);
});
test("portable masks validate lengths, bounds, source and counts", () => {
  const c = cover([20, 4, 5000, 10]);
  expect(isForestCover(c)).toBe(true);
  expect(isForestCover({ ...c, sensitivity: ["dense"] })).toBe(false);
  expect(isForestCover({ ...c, runs: [20, 4, 22, 10] })).toBe(false);
  expect(isForestCover({ ...c, runs: [-1, 14] })).toBe(false);
  expect(isForestCover({ ...c, runs: [0, Infinity] })).toBe(false);
  expect(isForestCover({ ...c, cells: 100 })).toBe(false);
  expect(isForestCover({ ...c, size: 999999 })).toBe(false);
  expect(isForestCover({ ...c, source: "remote-url" })).toBe(false);
  expect(
    isFlight({ ...emptyFlight(), autoTrees: JSON.parse(JSON.stringify(c)) }),
  ).toBe(true);
});
test("mask runs preserve holes and north-up coordinate placement", () => {
  const mask = new Uint8Array(2048 * 2048);
  mask[1024 * 2048 + 1024] = 1;
  mask[1024 * 2048 + 1026] = 1;
  const c = cover(encodeMask(mask).runs);
  expect(forestMask(c)[1024 * 2048 + 1025]).toBe(0);
  const bounds = { minX: 0, maxX: 204.8, minY: 0, maxY: 204.8 };
  expect(forestAt({ x: 102.45, y: 102.35 }, c, bounds, 0)).toBe(25);
  expect(forestAt({ x: 102.55, y: 102.35 }, c, bounds, 0)).toBe(0);
  expect(
    forestAt({ x: 102.45, y: 102.35 }, { ...c, enabled: false }, bounds, 0),
  ).toBe(0);
  const clearing = {
    id: "clear",
    kind: "clearing" as const,
    name: "Gap",
    height: 1,
    points: [
      { x: 102.4, y: 102.3 },
      { x: 102.5, y: 102.3 },
      { x: 102.5, y: 102.4 },
      { x: 102.4, y: 102.4 },
    ],
  };
  expect(
    coverHeight(
      { x: 102.45, y: 102.35 },
      { ...emptyFlight(), autoTrees: c, treeAreas: [clearing] },
      bounds,
      0,
    ),
  ).toBe(0);
});

test("pinned Bakurani reference patches retain tree/open-ground discrimination", async () => {
  const { default: sharp } = await import("sharp");
  const pixels = await sharp("public/maps/color/bakurani.webp")
    .resize(2048, 2048)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const result = detectForest(
    new Uint8ClampedArray(pixels),
    2048,
    2048,
    "balanced",
  );
  const mask = forestMask({
    ...cover(result.runs),
    cells: result.cells,
    patches: result.patches,
  });
  // Manually inspected source-image locations: two canopies, grass, field, roof.
  for (const [x, y, expected] of [
    [2662, 2723, 1],
    [2710, 2675, 1],
    [2834, 2739, 0],
    [2723, 2822, 0],
    [2560, 2818, 0],
  ])
    expect(mask[Math.floor(y / 2.5) * 2048 + Math.floor(x / 2.5)]).toBe(
      expected,
    );
});

test("portable plans reject automatic cover registered to another map", () => {
  const plan = {
    version: 1,
    name: "Forest export",
    map: {
      name: "Bakurani",
      width: 4096,
      height: 4096,
      image: "data:image/png;base64,AA==",
    },
    marks: [],
    flight: { ...emptyFlight(), autoTrees: cover([100, 5]) },
  };
  expect(
    validatePlan(JSON.parse(JSON.stringify(plan))).flight?.autoTrees?.runs,
  ).toEqual([100, 5]);
  expect(() =>
    validatePlan({
      ...plan,
      flight: {
        ...plan.flight,
        autoTrees: { ...plan.flight.autoTrees, map: "Ozeti" },
      },
    }),
  ).toThrow("different map");
});

test("narrow roads split canopy without density filling the gap at any sensitivity", () => {
  const size = 40;
  for (const sensitivity of ["dense", "balanced", "broad"] as const)
    for (const roadColor of [
      [135, 135, 128, 255],
      [145, 128, 96, 255],
    ]) {
      const rgba = new Uint8ClampedArray(size * size * 4);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          rgba.set(
            x === 20 ? roadColor : [150, 125, 45, 255],
            (y * size + x) * 4,
          );
      const result = detectForest(rgba, size, size, sensitivity);
      const mask = new Uint8Array(size * size);
      for (let i = 0; i < result.runs.length; i += 2)
        mask.fill(1, result.runs[i], result.runs[i] + result.runs[i + 1]);
      for (let y = 2; y < size - 2; y++) {
        expect(mask[y * size + 20]).toBe(0);
        expect(mask[y * size + 18]).toBe(1);
        expect(mask[y * size + 22]).toBe(1);
      }
      expect(result.patches).toBe(2);
    }
});

test("diagonal roads, clearings and transparent pixels stay outside the forest", () => {
  const size = 40,
    rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const color =
        x === y
          ? [145, 128, 96, 255]
          : x === 10 && y === 20
            ? [150, 125, 45, 0]
            : x >= 25 && x <= 27 && y >= 10 && y <= 12
              ? [170, 190, 60, 255]
              : [150, 125, 45, 255];
      rgba.set(color, (y * size + x) * 4);
    }
  const result = detectForest(rgba, size, size, "broad");
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < result.runs.length; i += 2)
    mask.fill(1, result.runs[i], result.runs[i] + result.runs[i + 1]);
  for (let y = 2; y < size - 2; y++) expect(mask[y * size + y]).toBe(0);
  expect(mask[20 * size + 10]).toBe(0);
  expect(mask[11 * size + 26]).toBe(0);
  expect(mask[15 * size + 25]).toBe(1);
  expect(isForestCover({ ...cover([20, 4]), detectorRevision: 2 })).toBe(true);
  expect(isForestCover({ ...cover([20, 4]), detectorRevision: 99 })).toBe(
    false,
  );
});
