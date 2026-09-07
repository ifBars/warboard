import { expect, test } from "bun:test";
import {
  towerSegmentClear,
  onLandingSide,
  choosePattern,
  fitFlightAltitudes,
  flankGate,
  searchCorridor,
  corridorCost,
  type AutoFlightRequest,
} from "./autoFlight";
import {
  emptyFlight,
  isFlight,
  routeAltitudes,
  routeLocations,
  type TerrainGrid,
} from "./flight";
const grid: TerrainGrid = {
  version: 1,
  size: 41,
  minX: 0,
  maxX: 20,
  minY: 0,
  maxY: 20,
  heights: Array(41 * 41).fill(100),
};
function request(): AutoFlightRequest {
  return {
    mapName: "Bakurani",
    grid,
    flight: emptyFlight(),
    towers: [],
    options: {
      start: { x: 3, y: 10 },
      end: { x: 17, y: 10 },
      flank: "auto",
      style: "combat",
      clearance: 18,
      cruise: 65,
      nearbyLanding: false,
      landingSide: "auto",
      towerClearance: 75,
      brakingDistance: 80,
      maneuver: "auto",
    },
  };
}
test("corridor search preserves endpoints and routes through a wide opening in a tree barrier", () => {
  const r = request();
  r.towers = [];
  r.flight.treeAreas = [
    {
      id: "north",
      name: "North trees",
      height: 25,
      points: [
        { x: 8, y: 11 },
        { x: 12, y: 11 },
        { x: 12, y: 20 },
        { x: 8, y: 20 },
      ],
    },
    {
      id: "south",
      name: "South trees",
      height: 25,
      points: [
        { x: 8, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 9 },
        { x: 8, y: 9 },
      ],
    },
  ];
  const points = searchCorridor(r);
  expect(points[0]).toEqual(r.options.start);
  expect(points.at(-1)).toEqual(r.options.end);
  const samples = routeLocations(
    points,
    { type: "direct", side: "left", size: 100 },
    true,
  );
  expect(
    samples
      .filter((p) => p.x > 8 && p.x < 12)
      .every((p) => p.y > 9 && p.y < 11),
  ).toBe(true);
});

test("combat prefers a sheltered valley detour and simplification retains it", () => {
  const r = request();
  r.grid = {
    ...grid,
    size: 101,
    heights: Array.from({ length: 101 * 101 }, (_, i) => {
      const x = (i % 101) / 5,
        y = 20 - Math.floor(i / 101) / 5;
      const center =
        10 + 1.6 * Math.sin(Math.PI * Math.max(0, Math.min(1, (x - 3) / 14)));
      return 100 + Math.min(35, Math.abs(y - center) * 45);
    }),
  };
  const points = searchCorridor(r);
  const samples = routeLocations(
    points,
    { type: "direct", side: "left", size: 100 },
    true,
  );
  const middle = samples.filter((p) => p.x > 8 && p.x < 12);
  expect(middle.length).toBeGreaterThan(0);
  expect(middle.every((p) => p.y > 11)).toBe(true);
  const metric = corridorCost(r);
  const cost = points
    .slice(1)
    .reduce((sum, p, i) => sum + metric.segment(points[i], p), 0);
  expect(cost).toBeLessThan(metric.segment(r.options.start, r.options.end));
});

test("combat stays low on transit away from control zones while transport uses cruise height", () => {
  const r = request();
  r.options.end = { x: 19, y: 10 };
  const f = {
    ...emptyFlight(),
    waypoints: [3, 5, 7, 9, 11, 13, 15, 17, 19].map((x, i) => ({
      id: String(i),
      name: "Transit",
      x,
      y: 10,
      altitude: 0,
    })),
  };
  const locations = routeLocations(f.waypoints, f.approach, true);
  const heights = locations.map(() => 100);
  const combat = fitFlightAltitudes(f, r, heights).flight;
  const transport = fitFlightAltitudes(
    f,
    { ...r, options: { ...r.options, style: "transport" } },
    heights,
  ).flight;
  expect(combat.waypoints[1].altitude).toBeLessThan(120);
  expect(transport.waypoints[1].altitude).toBeGreaterThanOrEqual(165);
});
test("curved turns preserve editable points and differ from straight chords", () => {
  const p = [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 9, y: 7 },
    { x: 13, y: 7 },
  ];
  const smooth = routeLocations(
    p,
    { type: "direct", side: "left", size: 100 },
    true,
  );
  expect(
    smooth.some(
      (s) => s.leg === 1 && Math.abs(s.y - 2 - ((s.x - 6) * 5) / 3) > 0.03,
    ),
  ).toBe(true);
  expect(smooth[0]).toMatchObject(p[0]);
  expect(smooth.at(-1)).toMatchObject(p.at(-1)!);
});
test("detailed terrain spikes raise interpolated flight altitude without losing endpoints or export compatibility", () => {
  const r = request();
  const f = {
    ...emptyFlight(),
    turns: "smooth" as const,
    approach: { type: "direct" as const, side: "left" as const, size: 100 },
    waypoints: [
      { id: "a", name: "Takeoff", x: 3, y: 10, altitude: 0 },
      { id: "b", name: "Transit", x: 10, y: 10, altitude: 0 },
      { id: "c", name: "LZ", x: 17, y: 10, altitude: 0 },
    ],
  };
  const locations = routeLocations(f.waypoints, f.approach, true),
    heights = locations.map((p) => (p.x > 9 && p.x < 11 ? 180 : 100));
  const fitted = fitFlightAltitudes(f, r, heights).flight;
  const profile = routeAltitudes(
    fitted,
    locations.map((p, i) => ({ ...p, ground: heights[i] })),
  );
  expect(profile.every((p) => p.altitude >= p.ground + 11.999)).toBe(true);
  expect(fitted.waypoints.at(-1)?.altitude).toBeCloseTo(112);
  expect(isFlight(JSON.parse(JSON.stringify(fitted)))).toBe(true);
  expect(isFlight({ ...fitted, turns: "arbitrary" })).toBe(false);
  expect(f.waypoints[1].altitude).toBe(0);
});
test("flank choice is map-oriented and invalid endpoints fail without generating a route", () => {
  const r = request();
  expect(flankGate({ ...r.options, flank: "east" })!.x).toBeGreaterThan(
    r.options.end.x,
  );
  expect(() =>
    searchCorridor({
      ...r,
      options: { ...r.options, start: { x: -2, y: 10 } },
    }),
  ).toThrow("coverage");
  expect(() =>
    searchCorridor({ ...r, options: { ...r.options, end: r.options.start } }),
  ).toThrow("100 m");
  expect(
    choosePattern(
      [
        { x: 3, y: 10 },
        { x: 14, y: 10 },
        { x: 17, y: 10 },
      ],
      r,
    ).type,
  ).toBe("j-hook");
});

test("tower structures are excluded at every altitude and western LZs are map-relative", () => {
  const r = request();
  r.towers = [{ x: 10, y: 10 }];
  const points = searchCorridor(r);
  expect(
    points.every((p, i) =>
      towerSegmentClear(points[Math.max(0, i - 1)], p, r.towers, 75),
    ),
  ).toBe(true);
  expect(
    towerSegmentClear({ x: 9, y: 10 }, { x: 11, y: 10 }, r.towers, 75),
  ).toBe(false);
  expect(onLandingSide({ x: 8, y: 10 }, { x: 10, y: 10 }, "west")).toBe(true);
  expect(onLandingSide({ x: 12, y: 10 }, { x: 10, y: 10 }, "west")).toBe(false);
  expect(() =>
    searchCorridor({ ...r, options: { ...r.options, end: { x: 10, y: 10 } } }),
  ).toThrow("tower");
});

test("entry-aligned J-hooks respect tower buffers and preserve optional portable fields", () => {
  const r = request();
  r.towers = [{ x: 10, y: 10 }];
  r.options.maneuver = "j-hook";
  const points = [
    { x: 9, y: 12 },
    { x: 7, y: 10 },
    { x: 9, y: 8 },
  ];
  const approach = choosePattern(points, r);
  expect(approach.type).toBe("j-hook");
  expect(approach.entryAligned).toBe(true);
  const curve = routeLocations(points, approach, true);
  expect(
    curve.every((p, i) =>
      towerSegmentClear(curve[Math.max(0, i - 1)], p, r.towers, 75),
    ),
  ).toBe(true);
  const flight = { ...emptyFlight(), approach, towerBuffer: 75 };
  expect(isFlight(JSON.parse(JSON.stringify(flight)))).toBe(true);
  expect(isFlight({ ...flight, towerBuffer: -1 })).toBe(false);
  expect(
    isFlight({ ...flight, approach: { ...approach, entryAligned: "yes" } }),
  ).toBe(false);
  expect(onLandingSide({ x: 10, y: 8 }, { x: 10, y: 10 }, "south")).toBe(true);
  expect(onLandingSide({ x: 10, y: 8 }, { x: 10, y: 10 }, "north")).toBe(false);
});

test("late descent clears sampled terrain without inflating the whole final leg", () => {
  const r = request();
  const base = {
    ...emptyFlight(),
    waypoints: [
      { id: "a", name: "Start", x: 3, y: 10, altitude: 0 },
      { id: "b", name: "Turn", x: 10, y: 10, altitude: 0 },
      { id: "c", name: "LZ", x: 17, y: 10, altitude: 0 },
    ],
  };
  const pattern: NonNullable<typeof base.approach> = {
    type: "direct",
    side: "left",
    size: 100,
  };
  const straight = { ...base, approach: pattern },
    late = { ...base, approach: { ...pattern, descent: "late" as const } };
  const points = routeLocations(base.waypoints, pattern, true),
    heights = points.map((p) => (p.x > 15 && p.x < 16 ? 145 : 100));
  const a = fitFlightAltitudes(straight, r, heights).flight,
    b = fitFlightAltitudes(late, r, heights).flight;
  expect(b.waypoints[1].altitude).toBeLessThan(a.waypoints[1].altitude);
  expect(
    routeAltitudes(
      b,
      points.map((p, i) => ({ ...p, ground: heights[i] })),
    ).every((p) => p.altitude >= p.ground + 11.99),
  ).toBe(true);
  expect(b.waypoints.at(-1)?.altitude).toBeCloseTo(112);
});

test("compact braking distance is independent of tower clearance and retains the arrival-side anchor", () => {
  const r = request();
  const o = {
    ...r.options,
    towerClearance: 35,
    brakingDistance: 80,
    flank: "west" as const,
  };
  const gate = flankGate(o, { x: 17, y: 10 })!;
  expect(gate.x).toBeCloseTo(16.2);
  expect(gate.y).toBe(10);
  expect(
    flankGate({ ...o, brakingDistance: 120 }, { x: 17, y: 10 })!.x,
  ).toBeCloseTo(15.8);
  r.towers = [{ x: 10, y: 10 }];
  r.options = {
    ...o,
    start: { x: 3, y: 10 },
    end: { x: 10.3, y: 9.7 },
    flank: "auto",
  };
  const corridor = searchCorridor(r);
  expect(corridor.at(-1)).toEqual(r.options.end);
  expect(
    corridor.every((p, i) =>
      towerSegmentClear(corridor[Math.max(0, i - 1)], p, r.towers, 35),
    ),
  ).toBe(true);
});
