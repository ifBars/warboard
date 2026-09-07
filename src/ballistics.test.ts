import { describe, expect, test } from "bun:test";
import {
  correctedAim,
  firingSolution,
  interpolate,
  parseCoordinates,
  profiles,
  rangeBearing,
} from "./ballistics";
import { toGame, toPixel } from "./cartography";
import { validatePlan, type Plan } from "./model";

const map = {
  name: "Bakurani",
  width: 4096,
  height: 4096,
  image: "data:image/png;base64,AAAA",
};
describe("Game-coordinate geometry", () => {
  test("north-up compass bearings in every quadrant", () => {
    for (const [point, bearing] of [
      [{ x: 80, y: 81 }, 0],
      [{ x: 81, y: 80 }, 90],
      [{ x: 80, y: 79 }, 180],
      [{ x: 79, y: 80 }, 270],
    ] as const) {
      expect(rangeBearing({ x: 80, y: 80 }, point)).toEqual({
        meters: 100,
        bearing,
      });
    }
    expect(rangeBearing({ x: 0, y: 0 }, { x: 3, y: 4 }).meters).toBe(500);
    expect(rangeBearing({ x: 80, y: 80 }, { x: 80, y: 80 }).bearing).toBeNull();
  });
  test("full-image tile bounds are independent of playable bounds", () => {
    expect(toGame({ x: 0, y: 0 }, map)).toEqual({ x: -0.03, y: 163.83 });
    const a = toGame({ x: 1000, y: 2000 }, map)!,
      b = toGame({ x: 1250, y: 2000 }, map)!;
    expect(rangeBearing(a, b).meters).toBeCloseTo(1000, 8);
    expect(toPixel(a, map)!.x).toBeCloseTo(1000, 8);
    expect(toPixel(a, map)!.y).toBeCloseTo(2000, 8);
    expect(
      toGame({ x: 0, y: 0 }, { ...map, name: "Screenshot.png" }),
    ).toBeNull();
  });
  test("paste accepts labelled or plain coordinates and rejects ambiguity", () => {
    expect(parseCoordinates("x62.18, y52.42")).toEqual({ x: 62.18, y: 52.42 });
    expect(parseCoordinates("80.25 72.50")).toEqual({ x: 80.25, y: 72.5 });
    for (const s of ["80,25,72,50", "", "Infinity 20", "X 200 Y 80", "1 2 3"]) {
      expect(parseCoordinates(s)).toBeNull();
    }
  });
  test("spotter corrections oppose observed miss in gun-relative axes", () => {
    const gun = { x: 80, y: 80 };
    expect(correctedAim(gun, { x: 80, y: 85 }, 100, 50)).toEqual({
      x: 79.5,
      y: 84,
    });
    expect(correctedAim(gun, { x: 85, y: 80 }, 100, 50)).toEqual({
      x: 84,
      y: 80.5,
    });
    expect(correctedAim(gun, { x: 80, y: 85 }, -100, -50)).toEqual({
      x: 80.5,
      y: 86,
    });
  });
});
describe("Community firing tables", () => {
  test("respects supported limits and never extrapolates", () => {
    for (const p of profiles) {
      expect(firingSolution(p.id, p.min - 0.01)).toEqual([]);
      expect(firingSolution(p.id, p.max + 0.01)).toEqual([]);
      expect(firingSolution(p.id, p.min).length).toBeGreaterThan(0);
      expect(firingSolution(p.id, p.max).length).toBeGreaterThan(0);
      expect(firingSolution(p.id, NaN)).toEqual([]);
    }
    expect(firingSolution("mortar", 132)[0].mil).toEqual([850, 850]);
    expect(firingSolution("spg", 2000).map((x) => x.arc)).toEqual([
      "low",
      "high",
    ]);
  });
  test("interpolates while preserving ambiguous exact samples", () => {
    expect(
      interpolate(
        [
          [100, 800],
          [200, 700],
        ],
        150,
      ),
    ).toEqual([750, 750]);
    expect(
      interpolate(
        [
          [100, 800],
          [100, 810],
          [200, 700],
        ],
        100,
      ),
    ).toEqual([800, 810]);
    expect(
      interpolate(
        [
          [100, 800],
          [200, 700],
        ],
        250,
      ),
    ).toBeNull();
  });
  test("all source samples within weapon limits remain reproducible", () => {
    for (const p of profiles)
      for (const table of Object.values(p.tables))
        for (const [distance, mil] of table) {
          if (
            distance < p.min ||
            distance > p.max ||
            mil < p.minMil ||
            mil > p.maxMil
          )
            continue;
          const results = firingSolution(p.id, distance);
          expect(results.some((r) => mil >= r.mil[0] && mil <= r.mil[1])).toBe(
            true,
          );
        }
  });
});
test("portable plans validate mission data and retain old plans", () => {
  const plan: Plan = { version: 1, name: "Test", map, marks: [] };
  expect(validatePlan(plan)).toEqual(plan);
  expect(() =>
    validatePlan({
      ...plan,
      mission: { weapon: "unknown", gun: null, target: null, targets: [] },
    }),
  ).toThrow();
  expect(() =>
    validatePlan({
      ...plan,
      mission: {
        weapon: "mortar",
        gun: { x: Infinity, y: 80 },
        target: null,
        targets: [],
      },
    }),
  ).toThrow();
  const mission = {
    weapon: "mortar" as const,
    gun: { x: 80, y: 80 },
    target: { x: 80, y: 85 },
    targets: [{ id: "a", name: "Bridge", point: { x: 80, y: 85 } }],
  };
  expect(
    validatePlan(JSON.parse(JSON.stringify({ ...plan, mission }))).mission,
  ).toEqual(mission);
});
