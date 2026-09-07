import { expect, test } from "bun:test";
import { decodeHeight, locateTerrain, type TerrainManifest } from "./terrain";
import { budgetSummary, emptyOperations } from "./operations";
import { validatePlan } from "./model";
test("terrain decoder interpolates a known little-endian grid", () => {
  const m = {
    verticesPerSide: 2,
    worldZOffsetMeters: 0.5,
    worldZScaleMetersPerLocalUnit: 9,
  } as TerrainManifest;
  const values = new DataView(new ArrayBuffer(8));
  [0, 65535, 0, 65535].forEach((n, i) => values.setUint16(i * 2, n, true));
  const entry = {
    minLocalZ: 0,
    maxLocalZ: 10,
  } as TerrainManifest["chunks"][string];
  expect(decodeHeight(m, entry, values, 0, 0)).toBe(0.5);
  expect(decodeHeight(m, entry, values, 1, 1)).toBe(90.5);
  expect(decodeHeight(m, entry, values, 0.5, 0.5)).toBe(45.5);
});
test("terrain mapping covers edges and keeps north-up Y orientation", async () => {
  const m = (await Bun.file(
    "public/terrain/bakurani/manifest.json",
  ).json()) as TerrainManifest;
  const south = locateTerrain(m, { x: 80, y: 80 })!,
    north = locateTerrain(m, { x: 80, y: 81 })!;
  expect(north.key).toBe(south.key);
  expect(north.y).toBe(south.y - 50);
  expect(locateTerrain(m, { x: 164, y: 80 })).toBeNull();
  expect(locateTerrain(m, { x: 0, y: 0 })).not.toBeNull();
  expect(locateTerrain(m, { x: 163.2, y: 163.2 })).not.toBeNull();
});
test("budget reserves cash and charges transport once", () => {
  expect(
    budgetSummary({ cash: 10000, reserve: 1000, kit: 3000, transport: 1000 }),
  ).toEqual({ after: 6000, deployments: 2, shortfall: 0 });
  expect(
    budgetSummary({ cash: 500, reserve: 1000, kit: 3000, transport: 1000 }),
  ).toEqual({ after: -3500, deployments: 0, shortfall: 4500 });
  expect(
    budgetSummary({ cash: 10000, reserve: 0, kit: 0, transport: 0 })
      .deployments,
  ).toBeNull();
});
test("operations imports reject unsafe counts and duplicate tasks", () => {
  const plan = {
    version: 1,
    name: "Ops",
    map: {
      name: "Test",
      width: 1,
      height: 1,
      image: "data:image/png;base64,AAAA",
    },
    marks: [],
    operations: emptyOperations(),
  };
  expect(validatePlan(plan).operations?.briefing).toBe("");
  expect(() =>
    validatePlan({
      ...plan,
      operations: {
        ...emptyOperations(),
        budget: { cash: Infinity, reserve: 0, kit: 0, transport: 0 },
      },
    }),
  ).toThrow();
  const task = { id: "same", text: "Task", done: false };
  expect(() =>
    validatePlan({
      ...plan,
      operations: { ...emptyOperations(), tasks: [task, task] },
    }),
  ).toThrow();
});
