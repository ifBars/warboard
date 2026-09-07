import { describe, expect, test } from "bun:test";
import {
  assessPatch,
  canopyAt,
  emptyFlight,
  gridHeight,
  isFlight,
  routeAltitudes,
  routeLocations,
  validTreeOutline,
  type Flight,
  type TerrainGrid,
} from "./flight";
import { validatePlan, type Plan } from "./model";
import { planBriefing } from "./briefing";
const grid: TerrainGrid = {
  version: 1,
  size: 2,
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
  heights: [100, 200, 300, 400],
};
describe("Flight planning geometry", () => {
  test("landing patterns preserve earlier legs, endpoints and sample spacing", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 12, y: 10 },
      { x: 14, y: 10 },
    ];
    const left = routeLocations(points, {
      type: "j-hook",
      side: "left",
      size: 100,
    });
    const right = routeLocations(points, {
      type: "j-hook",
      side: "right",
      size: 100,
    });
    expect(left.filter((p) => p.leg === 0)).toEqual(
      routeLocations(points).filter((p) => p.leg === 0),
    );
    expect(left.at(-1)).toMatchObject({ x: 14, y: 10, t: 1, leg: 1 });
    expect(left.some((p) => p.x > 14)).toBe(true);
    expect(left.some((p) => p.y > 10)).toBe(true);
    expect(right.some((p) => p.y < 10)).toBe(true);
    expect(
      left.every(
        (p, i) =>
          i === 0 ||
          (p.distance >= left[i - 1].distance &&
            p.distance - left[i - 1].distance <= 10.001),
      ),
    ).toBe(true);
    const s = routeLocations(points, {
      type: "s-turn",
      side: "left",
      size: 100,
    });
    expect(s.some((p) => p.y > 10)).toBe(true);
    expect(s.some((p) => p.y < 10)).toBe(true);
    expect(
      routeLocations([points[0], points[0]], {
        type: "j-hook",
        side: "left",
        size: 100,
      }).every((p) => Number.isFinite(p.t)),
    ).toBe(true);
  });
  test("traced canopy includes boundary buffers and tallest overlapping cover", () => {
    const area = {
      id: "trees",
      name: "Trees",
      height: 25,
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    };
    expect(canopyAt({ x: 1.5, y: 1.5 }, [area])).toBe(25);
    expect(canopyAt({ x: 0.95, y: 1.5 }, [area])).toBe(25);
    expect(canopyAt({ x: 0.8, y: 1.5 }, [area])).toBe(0);
    expect(canopyAt({ x: 1.5, y: 1.5 }, [area, { ...area, height: 40 }])).toBe(
      40,
    );
    const flight = { ...emptyFlight(), treeAreas: [area] };
    expect(isFlight(JSON.parse(JSON.stringify(flight)))).toBe(true);
    expect(
      validTreeOutline([area.points[0], area.points[0], area.points[0]]),
    ).toBe(false);
    expect(isFlight({ ...emptyFlight(), treeAreas: [area] })).toBe(true);
    expect(
      isFlight({
        ...emptyFlight(),
        treeAreas: [{ ...area, height: Infinity }],
      }),
    ).toBe(false);
    expect(isFlight({ ...emptyFlight(), treeAreas: [area, area] })).toBe(false);
    expect(
      isFlight({
        ...emptyFlight(),
        treeAreas: [{ ...area, points: area.points.slice(0, 2) }],
      }),
    ).toBe(false);
    expect(
      isFlight({
        ...emptyFlight(),
        approach: { type: "j-hook", side: "left", size: NaN },
      }),
    ).toBe(false);
  });
  test("preview is north-up, bilinear, and refuses uncovered ground", () => {
    expect(gridHeight(grid, { x: 0, y: 1 })).toBe(100);
    expect(gridHeight(grid, { x: 1, y: 0 })).toBe(400);
    expect(gridHeight(grid, { x: 0.5, y: 0.5 })).toBe(250);
    expect(gridHeight(grid, { x: -0.01, y: 0.5 })).toBeNull();
  });
  test("route uses 100 metres per game unit with bounded spacing and north-up coordinates", () => {
    const route = routeLocations([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
    ]);
    expect(route.at(-1)?.distance).toBe(600);
    expect(route[50].distance).toBe(500);
    expect(route[50].t).toBe(1);
    expect(route.at(-1)?.leg).toBe(1);
    expect(
      route.every(
        (p, i) => i === 0 || p.distance - route[i - 1].distance <= 10.001,
      ),
    ).toBe(true);
  });
  test("AGL follows terrain; absolute altitude exposes an intervening ridge", () => {
    const f: Flight = {
      version: 1,
      mode: "absolute",
      waypoints: [
        { id: "a", name: "A", x: 0, y: 0, altitude: 100 },
        { id: "b", name: "B", x: 1, y: 0, altitude: 100 },
      ],
    };
    const samples = routeLocations(f.waypoints).map((p) => ({
      ...p,
      ground: p.t === 0.5 ? 150 : 20,
    }));
    expect(routeAltitudes(f, samples).some((p) => p.altitude < p.ground)).toBe(
      true,
    );
    expect(
      routeAltitudes({ ...f, mode: "agl" }, samples).every(
        (p) => p.altitude - p.ground === 100,
      ),
    ).toBe(true);
  });
  test("flat-ground assessment distinguishes slope from local bumps", () => {
    const flat = Array(121).fill(50);
    expect(assessPatch(flat, 11, 2)).toEqual({
      slope: 0,
      roughness: 0,
      relief: 0,
    });
    const tilted = flat.map((h, i) => h + ((i % 11) - 5) * 2 * 0.1);
    expect(assessPatch(tilted, 11, 2).slope).toBeCloseTo(
      (Math.atan(0.1) * 180) / Math.PI,
      5,
    );
    expect(assessPatch(tilted, 11, 2).roughness).toBeLessThan(1e-10);
    flat[60] += 3;
    expect(assessPatch(flat, 11, 2).roughness).toBeGreaterThan(2.9);
  });
  test("invalid or incomplete patches cannot produce candidate metrics", () => {
    expect(() => assessPatch([0, NaN, 0], 3, 2)).toThrow();
    expect(() => assessPatch(Array(16).fill(0), 4, 2)).toThrow();
  });
});
test("flight import boundaries and legacy plan compatibility", () => {
  const base: Plan = {
    version: 1,
    name: "Flight test",
    map: {
      name: "Bakurani",
      image: "data:image/png;base64,AA==",
      width: 4096,
      height: 4096,
    },
    marks: [],
  };
  expect(validatePlan(base).flight).toBeUndefined();
  const f: Flight = {
    ...emptyFlight(),
    waypoints: [{ id: "a", name: "Pickup", x: 80, y: 70, altitude: 120 }],
  };
  expect(
    validatePlan(JSON.parse(JSON.stringify({ ...base, flight: f }))).flight,
  ).toEqual(f);
  expect(isFlight({ ...f, waypoints: [...f.waypoints, ...f.waypoints] })).toBe(
    false,
  );
  expect(
    isFlight({ ...f, waypoints: [{ ...f.waypoints[0], altitude: -1 }] }),
  ).toBe(false);
  expect(
    isFlight({ ...f, waypoints: [{ ...f.waypoints[0], x: Infinity }] }),
  ).toBe(false);
  expect(
    isFlight({
      ...f,
      waypoints: Array.from({ length: 33 }, (_, i) => ({
        ...f.waypoints[0],
        id: String(i),
      })),
    }),
  ).toBe(false);
  expect(() => validatePlan({ ...base, flight: { version: 2 } })).toThrow(
    "invalid flight",
  );
  expect(planBriefing({ ...base, flight: f })).toContain("Pickup");
  expect(planBriefing({ ...base, flight: f })).toContain("120 m");
});
