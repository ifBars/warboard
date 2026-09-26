import type { ObstacleGrid } from "./obstacles";

// Separable running min/max over a square window. Opening (erode, then dilate)
// removes raised features narrower than the window while reproducing planar
// slopes exactly, so surface - opening isolates buildings from hillsides.
function filter(
  input: Float32Array,
  size: number,
  radius: number,
  pick: (a: number, b: number) => number,
) {
  const temp = new Float32Array(input.length),
    out = new Float32Array(input.length);
  for (let row = 0; row < size; row++) {
    const base = row * size;
    for (let col = 0; col < size; col++) {
      let v = input[base + col];
      for (let d = 1; d <= radius; d++) {
        if (col - d >= 0) v = pick(v, input[base + col - d]);
        if (col + d < size) v = pick(v, input[base + col + d]);
      }
      temp[base + col] = v;
    }
  }
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      let v = temp[row * size + col];
      for (let d = 1; d <= radius; d++) {
        if (row - d >= 0) v = pick(v, temp[(row - d) * size + col]);
        if (row + d < size) v = pick(v, temp[(row + d) * size + col]);
      }
      out[row * size + col] = v;
    }
  return out;
}
export const opening = (surface: Float32Array, size: number, radius: number) =>
  filter(filter(surface, size, radius, Math.min), size, radius, Math.max);

export type TerrainFeatures = {
  span: number;
  /** Source cell size in metres. */
  cellMeters: number;
  /** Ground with structures removed, row 0 north, groundSize² metres. */
  groundSize: number;
  ground: Float32Array;
  /** Stride 5: centre game x, game y, base, height above base, east-west length (m). */
  buildings: Float32Array;
  /** Stride 4: game x, game y, ground, canopy height above ground. */
  trees: Float32Array;
};

// Connected raised areas count as structures only when their edges behave
// like walls: a large share of their height is lost within one cell. Ridges,
// knolls and crests fall away over several cells and stay part of the ground.
export function structureMask(
  surface: Float32Array,
  ground: Float32Array,
  size: number,
  options: { minHeight?: number; wallShare?: number; maxArea?: number } = {},
) {
  const minHeight = options.minHeight ?? 2.5,
    wallShare = options.wallShare ?? 0.6,
    maxArea = options.maxArea ?? 1600;
  const raised = new Float32Array(surface.length);
  for (let i = 0; i < raised.length; i++) raised[i] = surface[i] - ground[i];
  const label = new Int32Array(surface.length).fill(-1),
    mask = new Uint8Array(surface.length),
    queue = new Int32Array(surface.length);
  for (let start = 0; start < raised.length; start++) {
    if (label[start] !== -1 || raised[start] < minHeight) continue;
    let head = 0,
      tail = 0,
      top = 0,
      wall = 0;
    queue[tail++] = start;
    label[start] = start;
    while (head < tail) {
      const i = queue[head++],
        row = (i / size) | 0,
        col = i - row * size;
      top = Math.max(top, raised[i]);
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const r = row + dr,
          c = col + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const j = r * size + c;
        if (raised[j] >= minHeight) {
          if (label[j] === -1) {
            label[j] = start;
            queue[tail++] = j;
          }
        } else wall = Math.max(wall, surface[i] - surface[j]);
      }
    }
    if (
      tail <= maxArea &&
      top <= 120 &&
      wall >= Math.max(minHeight, top * wallShare)
    )
      for (let k = 0; k < tail; k++) mask[queue[k]] = 1;
  }
  return mask;
}

export function extractFeatures(
  grid: ObstacleGrid,
  options: {
    radius?: number;
    minBuilding?: number;
    minTree?: number;
    groundSize?: number;
  } = {},
): TerrainFeatures {
  const { size, span } = grid;
  const radius = options.radius ?? 4,
    minTree = options.minTree ?? 2,
    groundSize = options.groundSize ?? 1024;
  if (size % groundSize) throw Error("Ground size must divide the grid.");
  const surface = new Float32Array(size * size);
  for (let i = 0; i < surface.length; i++)
    surface[i] = grid.surface[i] * grid.scale + grid.offset;
  const opened = opening(surface, size, radius);
  const structures = structureMask(surface, opened, size, {
    minHeight: options.minBuilding,
  });
  const bare = surface.map((h, i) => (structures[i] ? opened[i] : h));
  const cell = span / size,
    buildings: number[] = [],
    trees: number[] = [];
  for (let row = 0; row < size; row++) {
    const y = span - (row + 0.5) * cell;
    // Merge east-west runs of similar structure cells into one box.
    for (let col = 0; col < size;) {
      const i = row * size + col;
      if (!structures[i]) {
        col++;
        continue;
      }
      const base = bare[i],
        height = surface[i] - base;
      let end = col + 1;
      while (end < size) {
        const j = row * size + end;
        if (
          !structures[j] ||
          Math.abs(bare[j] - base) > 1.5 ||
          Math.abs(surface[j] - base - height) > 1.5
        )
          break;
        end++;
      }
      buildings.push(
        ((col + end) / 2) * cell,
        y,
        base,
        height,
        (end - col) * cell * 100,
      );
      col = end;
    }
    for (let col = 0; col < size; col++) {
      const i = row * size + col,
        canopy = grid.canopy[i];
      if (Number.isFinite(canopy) && canopy - surface[i] >= minTree)
        trees.push((col + 0.5) * cell, y, surface[i], canopy - surface[i]);
    }
  }
  const factor = size / groundSize,
    ground = new Float32Array(groundSize * groundSize);
  for (let row = 0; row < groundSize; row++)
    for (let col = 0; col < groundSize; col++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++)
          sum += bare[(row * factor + dy) * size + col * factor + dx];
      ground[row * groundSize + col] = sum / (factor * factor);
    }
  return {
    span,
    cellMeters: cell * 100,
    groundSize,
    ground,
    buildings: Float32Array.from(buildings),
    trees: Float32Array.from(trees),
  };
}

const jobs = new Map<string, Promise<TerrainFeatures>>();
/** Derives structures, trees and bare ground off the main thread, once per map. */
export function loadFeatures(map: string, groundSize = 1024) {
  const key = `${map.toLowerCase()}:${groundSize}`;
  let job = jobs.get(key);
  if (job) return job;
  job = new Promise<TerrainFeatures>((resolve, reject) => {
    const worker = new Worker(
      new URL("./terrainFeatures.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<{ features?: TerrainFeatures; error?: string }>,
    ) => {
      worker.terminate();
      if (event.data.features) resolve(event.data.features);
      else reject(Error(event.data.error ?? "Terrain detail unavailable."));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(Error("Terrain detail unavailable in this browser."));
    };
    worker.postMessage({ map, groundSize });
  });
  jobs.set(key, job);
  job.catch(() => jobs.delete(key));
  return job;
}
