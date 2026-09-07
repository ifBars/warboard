import {
  choosePattern,
  corridorCost,
  fitFlightAltitudes,
  flankGate,
  searchCorridor,
  towerSegmentClear,
  onLandingSide,
  type AutoFlightRequest,
  type AutoFlightResult,
} from "./autoFlight";
import {
  coverHeight,
  gridHeight,
  isFlight,
  routeLocations,
  type Flight,
} from "./flight";
import { terrainHeights } from "./terrain";
import { findFlatGround } from "./landing";
import { colorImage, detectForest } from "./forest";
const progress = (message: string) => self.postMessage({ progress: message });
self.onmessage = async (event: MessageEvent<AutoFlightRequest>) => {
  try {
    const request = event.data,
      { options, grid } = request,
      warnings: string[] = [];
    if (!request.flight.autoTrees) {
      progress("Detecting tree cover and road-like gaps…");
      const map = request.mapName;
      if (map !== "Bakurani" && map !== "Ozeti")
        throw Error("Unsupported map.");
      const response = await fetch(colorImage(map)!);
      if (!response.ok)
        throw Error(
          "Tree imagery is unavailable. Reconnect before building a route.",
        );
      const blob = await response.blob();
      if (blob.size > 16 * 1024 * 1024)
        throw Error("Detection image is too large.");
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width !== 5120 || bitmap.height !== 5120) {
        bitmap.close();
        throw Error("Unexpected detection image dimensions.");
      }
      const canvas = new OffscreenCanvas(2048, 2048),
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        bitmap.close();
        throw Error("Image analysis is unavailable.");
      }
      ctx.drawImage(bitmap, 0, 0, 2048, 2048);
      bitmap.close();
      const result = detectForest(
        ctx.getImageData(0, 0, 2048, 2048).data,
        2048,
        2048,
        "balanced",
      );
      request.flight = {
        ...request.flight,
        autoTrees: {
          version: 1,
          detectorRevision: 2,
          source: "wardogs-zone-color-v1",
          map,
          size: 2048,
          sensitivity: "balanced",
          height: 25,
          enabled: true,
          ...result,
        },
      };
    }
    // Detection visibility is independent of whether routing respects obstacles.
    if (request.flight.autoTrees)
      request.flight = {
        ...request.flight,
        autoTrees: { ...request.flight.autoTrees, enabled: true },
      };
    const requestedEnd = { ...options.end };
    if (options.nearbyLanding) {
      progress("Checking nearby landing footprints at 2 m spacing…");
      const candidates = await findFlatGround(
        request.mapName,
        options.end,
        grid,
        10,
        7,
        1,
        (p) =>
          coverHeight(p, request.flight, grid, 26) === 0 &&
          towerSegmentClear(p, p, request.towers, options.towerClearance + 5) &&
          onLandingSide(p, requestedEnd, options.landingSide),
        10,
      );
      const open = candidates.filter(
        (p) => coverHeight(p, request.flight, grid, 26) === 0,
      );
      open.sort(
        (a, b) =>
          Math.hypot(a.x - options.end.x, a.y - options.end.y) -
          Math.hypot(b.x - options.end.x, b.y - options.end.y),
      );
      if (!open.length)
        throw Error(
          "No clear, flat LZ on this side outside the tower buffer. Try another landing side, a custom LZ, or review the tree outlines.",
        );
      options.end = { x: open[0].x, y: open[0].y };
    }
    if (coverHeight(options.end, request.flight, grid, 22) > 0)
      throw Error(
        "The landing footprint overlaps estimated tree cover. Choose a clearing or enable nearby landing search.",
      );
    progress("Searching terrain corridors…");
    const gate = flankGate(options, requestedEnd);
    if (gate && gridHeight(grid, gate) === null)
      throw Error(
        "That approach flank is outside terrain coverage. Choose another side.",
      );
    const points = gate
      ? [
          ...searchCorridor(
            { ...request, options: { ...options, end: gate } },
            progress,
          ),
          options.end,
        ]
      : searchCorridor(request, progress);
    // Preserve the searched corridor when fitting the portable waypoint limit.
    const metric = corridorCost(request);
    while (points.length > 29) {
      let best = -1,
        score = Infinity;
      for (let i = 1; i < points.length - 2; i++) {
        const a = points[i - 1],
          b = points[i],
          c = points[i + 1];
        const original = metric.segment(a, b) + metric.segment(b, c);
        const shortcut = metric.segment(a, c);
        if (!Number.isFinite(shortcut) || shortcut > original * 1.08) continue;
        const detour = shortcut - original;
        if (detour < score) {
          score = detour;
          best = i;
        }
      }
      if (best < 0)
        throw Error(
          "This concealed corridor needs more than 32 waypoints. Try a shorter route or a different approach side.",
        );
      points.splice(best, 1);
    }
    if (points.length === 2)
      points.splice(1, 0, {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      });
    // A short terminal gate limits the landing-pattern footprint.
    const last = points.at(-1)!,
      before = points.at(-2)!;
    const length = Math.hypot(last.x - before.x, last.y - before.y);
    if (!gate && length > 3)
      points.splice(points.length - 1, 0, {
        x: last.x + ((before.x - last.x) * 3) / length,
        y: last.y + ((before.y - last.y) * 3) / length,
      });
    // Shorter altitude legs keep a takeoff climb from inflating an entire
    // kilometre-long transit segment. Preserve corridor bends when subdividing.
    let spacing = 180;
    const subdivide = () =>
      points
        .slice(1)
        .flatMap((b, i) => {
          if (gate && i === points.length - 2) return [points[i]];
          const a = points[i],
            n = Math.max(
              1,
              Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) * 100) / spacing),
            );
          return Array.from({ length: n }, (_, j) => ({
            x: a.x + ((b.x - a.x) * j) / n,
            y: a.y + ((b.y - a.y) * j) / n,
          }));
        })
        .concat([points.at(-1)!]);
    let detailed = subdivide();
    while (detailed.length > 32) {
      spacing *= 1.2;
      detailed = subdivide();
    }
    points.splice(0, points.length, ...detailed);
    const approach = choosePattern(points, request);
    const flight: Flight = {
      ...request.flight,
      mode: "absolute",
      towerBuffer: options.towerClearance,
      turns: "smooth",
      approach,
      waypoints: points.map((p, i) => ({
        ...p,
        id: crypto.randomUUID(),
        name:
          i === 0
            ? "Takeoff"
            : i === points.length - 1
              ? "LZ · hover / inspect"
              : i === points.length - 2
                ? "Final approach"
                : `Transit ${i}`,
        altitude: 0,
      })),
    };
    const samples = routeLocations(flight.waypoints, approach, true);
    if (
      samples.some(
        (p, i) =>
          !towerSegmentClear(
            samples[Math.max(0, i - 1)],
            p,
            request.towers,
            options.towerClearance,
          ),
      )
    )
      throw Error(
        "A curved turn cuts into a tower buffer. Choose a wider approach flank or a farther LZ.",
      );
    progress(
      "Checking curved-route clearance against the detailed height field…",
    );
    // Sample the route and both sides of a 24 m rotor corridor.
    const probes = samples.flatMap((p, i) => {
      const a = samples[Math.max(0, i - 1)],
        b = samples[Math.min(samples.length - 1, i + 1)],
        d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return [
        p,
        {
          x: p.x - ((b.y - a.y) / d) * 0.12,
          y: p.y + ((b.x - a.x) / d) * 0.12,
        },
        {
          x: p.x + ((b.y - a.y) / d) * 0.12,
          y: p.y - ((b.x - a.x) / d) * 0.12,
        },
      ];
    });
    const terrain = await terrainHeights(request.mapName, probes);
    const heights = samples.map((_, i) =>
      Math.max(...terrain.slice(i * 3, i * 3 + 3)),
    );
    const fitted = fitFlightAltitudes(flight, request, heights);
    if (!isFlight(fitted.flight))
      throw Error(
        "Generated route exceeds the portable plan limits. Try a shorter route.",
      );
    const treeSamples = samples.filter(
      (p) => coverHeight(p, request.flight, grid, 12) > 0,
    ).length;
    if (treeSamples)
      warnings.push(
        `Some curved segments fly above estimated canopy rather than through gaps (${treeSamples} samples).`,
      );
    if (fitted.maxGradient > 0.35)
      warnings.push(
        "Some climbs or descents are steep. Reduce speed and review the height profile; aircraft performance is not calibrated.",
      );
    warnings.push(
      `Tower centers have a ${options.towerClearance} m exclusion radius at every altitude. This is a planning buffer, not a measured tower footprint.`,
    );
    warnings.push(
      "Ends at a 12 m inspection hover. Buildings, wires, water and live threats are not mapped; landing and combat exposure remain unverified.",
    );
    const result: AutoFlightResult = {
      flight: fitted.flight,
      distance: samples.at(-1)?.distance ?? 0,
      warnings,
      landingOffset:
        Math.hypot(
          options.end.x - requestedEnd.x,
          options.end.y - requestedEnd.y,
        ) * 100,
      spacing: samples
        .slice(1)
        .reduce((m, p, i) => Math.max(m, p.distance - samples[i].distance), 0),
      pattern: `${approach.type}${approach.type !== "direct" ? ` · ${approach.side}` : ""}`,
    };
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Route generation failed.",
    });
  }
};
