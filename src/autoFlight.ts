import {
  altitudeFraction,
  coverHeight,
  gridHeight,
  routeLocations,
  type Flight,
  type LandingApproach,
  type TerrainGrid,
} from "./flight";
import type { Point } from "./model";
import { obstacleHeight, onRoad, type ObstacleGrid } from "./obstacles";

export type AutoFlightOptions = {
  start: Point;
  end: Point;
  flank: "auto" | "east" | "west" | "north" | "south";
  style: "combat" | "transport";
  clearance: number;
  cruise: number;
  nearbyLanding: boolean;
  landingSide: "auto" | "east" | "west" | "north" | "south";
  towerClearance: number;
  brakingDistance: number;
  maneuver: "auto" | "j-hook" | "s-turn" | "direct";
};
export type AutoFlightRequest = {
  obstacles?: ObstacleGrid;
  mapName: string;
  grid: TerrainGrid;
  flight: Flight;
  towers: Point[];
  options: AutoFlightOptions;
};
export type AutoFlightResult = {
  flight: Flight;
  distance: number;
  warnings: string[];
  landingOffset: number;
  spacing: number;
  pattern: string;
};
const meters = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) * 100;
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Prefer positioned geometry over image classification; retain manual hazard areas.
export function flightCoverForRouting(request: AutoFlightRequest): Flight {
  return request.obstacles
    ? { ...request.flight, autoTrees: undefined }
    : request.flight;
}

// Relative relief and nearby canopy are concealment proxies, not enemy LOS.
export function corridorCost(request: AutoFlightRequest) {
  const { grid, towers, options: o } = request;
  const flight = flightCoverForRouting(request);
  const density = (p: Point) => {
    const h = gridHeight(grid, p);
    if (h === null) return Infinity;
    const canopy = Math.max(
      coverHeight(p, flight, grid, 12),
      (obstacleHeight(request.obstacles, p, 12) ?? h) - h,
    );
    const control = Math.min(
      ...towers.map((t) => meters(t, p)),
      meters(o.end, p),
    );
    if (o.style !== "combat")
      return 1 + (canopy > 4 ? (control < 1200 ? 8 : 2) : 0);
    let shelter = 0,
      low = h;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const q = { x: p.x + dx * 0.8, y: p.y + dy * 0.8 };
      const neighbor = gridHeight(grid, q);
      if (neighbor === null) continue;
      low = Math.min(low, neighbor);
      const obstacle = Math.max(
        neighbor + coverHeight(q, flight, grid, 0),
        obstacleHeight(request.obstacles, q) ?? neighbor,
      );
      shelter += Math.min(
        30,
        Math.max(0, obstacle - h - Math.max(o.clearance, canopy + 12)),
      );
    }
    return (
      1 +
      (canopy > 4 ? (control < 1200 ? 14 : 10) : 0) +
      Math.max(0, 3 - shelter / 20 - (onRoad(request.obstacles, p) ? 1.5 : 0)) +
      Math.min(3, (h - low) / 20) +
      (control < 500 && meters(p, o.end) > 300 ? 1.8 : 0)
    );
  };
  const segment = (a: Point, b: Point) => {
    if (!towerSegmentClear(a, b, towers, o.towerClearance)) return Infinity;
    const n = Math.max(1, Math.ceil(meters(a, b) / 8));
    let cost = 0,
      previous = a,
      height = gridHeight(grid, a);
    if (height === null) return Infinity;
    for (let i = 1; i <= n; i++) {
      const p = mix(a, b, i / n),
        h = gridHeight(grid, p);
      if (h === null) return Infinity;
      cost +=
        meters(previous, p) * density(p) +
        Math.abs(h - height) * 5 +
        Math.max(0, h - height) * 2;
      previous = p;
      height = h;
    }
    return cost;
  };
  return { density, segment };
}
export function towerSegmentClear(
  a: Point,
  b: Point,
  towers: Point[],
  radius: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  return towers.every((tower) => {
    const t = length
      ? Math.max(
          0,
          Math.min(1, ((tower.x - a.x) * dx + (tower.y - a.y) * dy) / length),
        )
      : 0;
    return meters(tower, { x: a.x + t * dx, y: a.y + t * dy }) >= radius;
  });
}
export function onLandingSide(
  p: Point,
  center: Point,
  side: AutoFlightOptions["landingSide"],
) {
  const dx = p.x - center.x,
    dy = p.y - center.y;
  return (
    side === "auto" ||
    (side === "west" && -dx >= Math.abs(dy)) ||
    (side === "east" && dx >= Math.abs(dy)) ||
    (side === "north" && dy >= Math.abs(dx)) ||
    (side === "south" && -dy >= Math.abs(dx))
  );
}

class MinHeap {
  items: { id: number; score: number }[] = [];
  push(id: number, score: number) {
    const item = { id, score };
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].score <= score) break;
      this.items[i] = this.items[p];
      i = p;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0],
      last = this.items.pop();
    if (!last || !this.items.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.items.length) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.items.length &&
        this.items[child + 1].score < this.items[child].score
      )
        child++;
      if (last.score <= this.items[child].score) break;
      this.items[i] = this.items[child];
      i = child;
    }
    this.items[i] = last;
    return first;
  }
}

// A bounded terrain-weighted search, not an aircraft physics or enemy model.
export function searchCorridor(
  request: AutoFlightRequest,
  progress: (message: string) => void = () => {},
) {
  const { grid, towers, options: o } = request;
  const flight = flightCoverForRouting(request);
  const metric = corridorCost(request);
  if (![o.start, o.end].every((p) => gridHeight(grid, p) !== null))
    throw Error("Choose endpoints inside terrain coverage.");
  if (
    ![o.start, o.end].every((p) =>
      towerSegmentClear(p, p, towers, o.towerClearance),
    )
  )
    throw Error(
      "An endpoint is inside a tower buffer. Choose a nearby LZ outside the tower structure.",
    );
  if (meters(o.start, o.end) < 100)
    throw Error("Choose endpoints at least 100 m apart.");
  const margin = 12;
  const minX = Math.max(grid.minX, Math.min(o.start.x, o.end.x) - margin),
    maxX = Math.min(grid.maxX, Math.max(o.start.x, o.end.x) + margin);
  const minY = Math.max(grid.minY, Math.min(o.start.y, o.end.y) - margin),
    maxY = Math.min(grid.maxY, Math.max(o.start.y, o.end.y) + margin);
  const step = Math.max(
    0.16,
    Math.sqrt(((maxX - minX) * (maxY - minY)) / 180000),
  );
  const width = Math.ceil((maxX - minX) / step) + 1,
    height = Math.ceil((maxY - minY) / step) + 1,
    count = width * height;
  const point = (id: number): Point =>
    id === start
      ? o.start
      : id === end
        ? o.end
        : {
            x: Math.min(maxX, minX + (id % width) * step),
            y: Math.min(maxY, minY + Math.floor(id / width) * step),
          };
  const index = (p: Point) =>
    Math.round((p.y - minY) / step) * width + Math.round((p.x - minX) / step);
  const ground = new Float32Array(count).fill(NaN),
    density = new Float32Array(count).fill(NaN);
  function terrain(id: number) {
    if (Number.isNaN(ground[id])) {
      const p = point(id);
      ground[id] = gridHeight(grid, p) ?? Infinity;
      density[id] = metric.density(p);
    }
    return ground[id];
  }
  const extraMargin = (p: Point) =>
    Math.min(24, meters(p, o.start) * 0.25, meters(p, o.end) * 0.25);
  const start = index(o.start),
    end = index(o.end),
    costs = new Float64Array(count).fill(Infinity),
    parents = new Int32Array(count).fill(-1),
    closed = new Uint8Array(count),
    heap = new MinHeap();
  costs[start] = 0;
  heap.push(start, meters(o.start, o.end));
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  let visited = 0;
  while (heap.items.length) {
    const current = heap.pop()!.id;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === end) break;
    if (++visited % 12000 === 0)
      progress(
        `Searching terrain corridors (${Math.round(visited / 1000)}k cells)…`,
      );
    const p = point(current),
      h = terrain(current),
      x = current % width,
      y = Math.floor(current / width);
    for (const [dx, dy] of neighbors) {
      if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height)
        continue;
      const id = (y + dy) * width + x + dx;
      if (closed[id]) continue;
      const q = point(id),
        nextHeight = terrain(id),
        d = meters(p, q);
      if (!Number.isFinite(nextHeight) || d === 0) continue;
      if (
        !towerSegmentClear(
          p,
          q,
          towers,
          o.towerClearance + Math.min(extraMargin(p), extraMargin(q)),
        )
      )
        continue;
      const slope = Math.abs(nextHeight - h) / d;
      let bend = 0;
      const parent = parents[current];
      if (parent >= 0) {
        const a = point(parent);
        const length = meters(a, p);
        bend =
          (1 -
            (((p.x - a.x) * (q.x - p.x) + (p.y - a.y) * (q.y - p.y)) * 10000) /
              (length * d)) *
          0.3;
      }
      const candidate =
        costs[current] +
        d * (density[id] + slope * 5 + bend) +
        Math.max(0, nextHeight - h) * 2;
      if (candidate < costs[id]) {
        costs[id] = candidate;
        parents[id] = current;
        heap.push(id, candidate + meters(q, o.end));
      }
    }
  }
  if (parents[end] < 0)
    throw Error(
      "No corridor found inside the search area. Try another approach side or endpoint.",
    );
  const path: Point[] = [];
  for (let id = end; id >= 0; id = parents[id]) {
    path.push(point(id));
    if (id === start) break;
  }
  path.reverse();
  path[0] = o.start;
  path[path.length - 1] = o.end;
  // Greedy visibility simplification checks the whole segment and preserves
  // detected gaps. It never treats a road-like clearing as verified road data.
  const reduced: Point[] = [path[0]];
  const cumulative = [0];
  for (let i = 1; i < path.length; i++)
    cumulative.push(cumulative[i - 1] + metric.segment(path[i - 1], path[i]));
  for (let i = 0; i < path.length - 1;) {
    let best = i + 1;
    for (let j = i + 2; j < Math.min(path.length, i + 65); j++) {
      const a = path[i],
        b = path[j],
        n = Math.ceil(meters(a, b) / 8);
      let valid = true;
      const endpointCover = Math.max(
        coverHeight(a, flight, grid, 12),
        coverHeight(b, flight, grid, 12),
      );
      for (let k = 1; k < n; k++) {
        const p = mix(a, b, k / n);
        if (
          coverHeight(p, flight, grid, 12) > endpointCover ||
          (gridHeight(grid, p) ?? Infinity) >
            Math.max(gridHeight(grid, a)!, gridHeight(grid, b)!) + 25
        ) {
          valid = false;
          break;
        }
      }
      if (
        valid &&
        metric.segment(a, b) <= (cumulative[j] - cumulative[i]) * 1.08 &&
        towerSegmentClear(
          a,
          b,
          towers,
          o.towerClearance + Math.min(extraMargin(a), extraMargin(b)),
        )
      )
        best = j;
    }
    reduced.push(path[best]);
    i = best;
  }
  return reduced;
}

export function choosePattern(
  points: Point[],
  request: AutoFlightRequest,
): LandingApproach {
  const choices: LandingApproach[] = [
    { type: "direct", side: "left", size: 100 },
  ];
  for (const type of ["j-hook", "s-turn"] satisfies LandingApproach["type"][])
    for (const side of ["left", "right"] satisfies LandingApproach["side"][])
      for (const size of request.options.style === "combat"
        ? [25, 40, 60]
        : [60, 100, 150])
        choices.push({ type, side, size, entryAligned: type === "j-hook" });
  let best = choices[0],
    bestCost = Infinity;
  for (const approach of choices) {
    if (
      request.options.maneuver !== "auto" &&
      request.options.maneuver !== approach.type
    )
      continue;
    const samples = routeLocations(points.slice(-3), approach, true),
      finalLeg = samples.filter((p) => p.leg === 1);
    let cost =
      approach.type === "j-hook" && request.options.style === "combat"
        ? -100
        : 0;
    if (
      samples.some(
        (p, i) =>
          !towerSegmentClear(
            samples[Math.max(0, i - 1)],
            p,
            request.towers,
            request.options.towerClearance,
          ),
      )
    )
      continue;
    for (const p of finalLeg) {
      const h = gridHeight(request.grid, p);
      if (h === null) {
        cost = Infinity;
        break;
      }
      const canopy = coverHeight(
        p,
        flightCoverForRouting(request),
        request.grid,
        12,
      );
      cost +=
        canopy * 2 +
        Math.max(0, h - (gridHeight(request.grid, points.at(-1)!) ?? h)) * 0.2;
    }
    cost += (samples.at(-1)?.distance ?? 0) * 0.1;
    if (cost < bestCost) {
      bestCost = cost;
      best = approach;
    }
  }
  if (!Number.isFinite(bestCost))
    throw Error(
      "No landing pattern clears the tower buffer here. Try another landing side or a farther LZ.",
    );
  return { ...best, descent: "late" };
}

export function flankGate(
  o: AutoFlightOptions,
  anchor: Point = o.end,
): Point | null {
  const d = meters(o.start, o.end);
  if (o.flank === "auto" || d < 150) return null;
  const offset =
    Math.min(Math.max(o.brakingDistance, o.towerClearance + 20), d * 0.7) / 100;
  return {
    x:
      anchor.x +
      (o.flank === "east" ? offset : o.flank === "west" ? -offset : 0),
    y:
      anchor.y +
      (o.flank === "north" ? offset : o.flank === "south" ? -offset : 0),
  };
}

export function fitFlightAltitudes(
  flight: Flight,
  request: AutoFlightRequest,
  heights: number[],
): { flight: Flight; maxGradient: number } {
  const samples = routeLocations(flight.waypoints, flight.approach, true);
  if (samples.length !== heights.length || !heights.every(Number.isFinite))
    throw Error("Incomplete terrain analysis.");
  const { options: o, grid } = request,
    total = samples.at(-1)?.distance ?? 0;
  const clearance = (p: (typeof samples)[number]) => {
    const from = p.distance,
      to = total - from,
      near = Math.min(
        ...request.towers.map((t) => meters(t, p)),
        meters(o.end, p),
      );
    const cruise = o.style === "combat" || near < 1200 ? o.clearance : o.cruise;
    const phase = Math.min(1, from / 180, to / 250);
    return Math.max(
      3,
      cruise * phase,
      coverHeight(p, flightCoverForRouting(request), grid, 12) + 12,
    );
  };
  const required = samples.map((p, i) =>
    Math.max(
      heights[i] + clearance(p),
      (obstacleHeight(request.obstacles, p, 12) ?? -Infinity) + 12,
    ),
  );
  const waypoints = flight.waypoints.map((p) => ({
    ...p,
    altitude: (gridHeight(grid, p) ?? 0) + o.clearance,
  }));
  waypoints[0].altitude =
    heights[0] +
    Math.max(
      12,
      coverHeight(o.start, flightCoverForRouting(request), grid, 12) + 12,
    );
  waypoints[0].altitude = Math.max(waypoints[0].altitude, required[0]);
  waypoints[waypoints.length - 1].altitude = Math.max(
    heights.at(-1)! + 12,
    required.at(-1)!,
  );
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i],
        a = waypoints[p.leg],
        b = waypoints[p.leg + 1],
        t = altitudeFraction(flight, p),
        deficit = required[i] - (a.altitude * (1 - t) + b.altitude * t);
      if (deficit <= 0) continue;
      if (p.leg === 0 && t > 0 && t < 1) b.altitude += deficit / t;
      else if (p.leg === waypoints.length - 2 && t < 1)
        a.altitude += deficit / (1 - t);
      else {
        a.altitude += deficit;
        b.altitude += deficit;
      }
    }
  if (waypoints.some((p) => !Number.isFinite(p.altitude) || p.altitude > 5000))
    throw Error(
      "This approach needs excessive climbing. Move the landing zone or use a different flank.",
    );
  let maxGradient = 0;
  const altitude = (i: number) => {
    const p = samples[i],
      t = altitudeFraction(flight, p);
    return (
      waypoints[p.leg].altitude * (1 - t) + waypoints[p.leg + 1].altitude * t
    );
  };
  for (let i = 1; i < samples.length; i++)
    maxGradient = Math.max(
      maxGradient,
      Math.abs(altitude(i) - altitude(i - 1)) /
        Math.max(0.01, samples[i].distance - samples[i - 1].distance),
    );
  return { flight: { ...flight, mode: "absolute", waypoints }, maxGradient };
}
