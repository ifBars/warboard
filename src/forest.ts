import { assetUrl } from "./assetUrl";
import type { Point } from "./model";
export type ForestSensitivity = "dense" | "balanced" | "broad";
export type ForestCover = {
  version: 1;
  source: "wardogs-zone-color-v1";
  detectorRevision?: 2;
  map: "Bakurani" | "Ozeti";
  size: 2048;
  sensitivity: ForestSensitivity;
  height: number;
  enabled: boolean;
  runs: number[];
  cells: number;
  patches: number;
};
export const colorImages = {
  Bakurani: assetUrl("/maps/color/bakurani.webp"),
  Ozeti: assetUrl("/maps/color/ozeti.webp"),
};
export function colorImage(name: string): string | null {
  return name === "Bakurani"
    ? colorImages.Bakurani
    : name === "Ozeti"
      ? colorImages.Ozeti
      : null;
}
export function isForestCover(v: unknown): v is ForestCover {
  if (!v || typeof v !== "object") return false;
  if (
    !("version" in v) ||
    v.version !== 1 ||
    !("source" in v) ||
    v.source !== "wardogs-zone-color-v1" ||
    ("detectorRevision" in v && v.detectorRevision !== 2) ||
    !("map" in v) ||
    (v.map !== "Bakurani" && v.map !== "Ozeti") ||
    !("size" in v) ||
    v.size !== 2048 ||
    !("height" in v) ||
    typeof v.height !== "number" ||
    !Number.isFinite(v.height) ||
    v.height < 1 ||
    v.height > 100 ||
    !("enabled" in v) ||
    typeof v.enabled !== "boolean" ||
    !("sensitivity" in v) ||
    (v.sensitivity !== "dense" &&
      v.sensitivity !== "balanced" &&
      v.sensitivity !== "broad") ||
    !("runs" in v) ||
    !Array.isArray(v.runs) ||
    v.runs.length > 500000 ||
    v.runs.length % 2 ||
    !("cells" in v) ||
    !("patches" in v) ||
    typeof v.patches !== "number" ||
    !Number.isInteger(v.patches) ||
    v.patches < 0 ||
    v.patches > 350000
  )
    return false;
  let end = 0,
    cells = 0;
  for (let i = 0; i < v.runs.length; i += 2) {
    const start = v.runs[i],
      length = v.runs[i + 1];
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(length) ||
      start < end ||
      length < 1 ||
      start + length > v.size * v.size
    )
      return false;
    end = start + length;
    cells += length;
  }
  return cells === v.cells;
}
export function encodeMask(mask: Uint8Array) {
  const runs: number[] = [];
  let cells = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const start = i;
    while (i < mask.length && mask[i]) i++;
    runs.push(start, i - start);
    cells += i - start;
  }
  return { runs, cells };
}
const masks = new WeakMap<ForestCover, Uint8Array>();
export function forestMask(cover: ForestCover) {
  const cached = masks.get(cover);
  if (cached) return cached;
  const mask = new Uint8Array(cover.size * cover.size);
  for (let i = 0; i < cover.runs.length; i += 2)
    mask.fill(1, cover.runs[i], cover.runs[i] + cover.runs[i + 1]);
  masks.set(cover, mask);
  return mask;
}
export type ForestBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
export function forestAt(
  p: Point,
  cover: ForestCover | undefined,
  bounds: ForestBounds,
  buffer = 10,
  excluded?: (point: Point) => boolean,
): number {
  if (!cover?.enabled) return 0;
  const sx = (bounds.maxX - bounds.minX) / cover.size,
    sy = (bounds.maxY - bounds.minY) / cover.size;
  const x = Math.floor((p.x - bounds.minX) / sx),
    y = Math.floor((bounds.maxY - p.y) / sy);
  const rx = Math.ceil(buffer / (sx * 100)),
    ry = Math.ceil(buffer / (sy * 100)),
    mask = forestMask(cover);
  for (let j = Math.max(0, y - ry); j <= Math.min(cover.size - 1, y + ry); j++)
    for (
      let i = Math.max(0, x - rx);
      i <= Math.min(cover.size - 1, x + rx);
      i++
    )
      if (
        mask[j * cover.size + i] &&
        !excluded?.({
          x: bounds.minX + (i + 0.5) * sx,
          y: bounds.maxY - (j + 0.5) * sy,
        })
      )
        return cover.height;
  return 0;
}
// Palette-specific detector with pixel evidence and road-like gap preservation.
// It estimates cover from this map render; it does not measure tree heights.
export function detectForest(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity: ForestSensitivity,
  onProgress: (progress: number) => void = () => {},
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 3 ||
    height < 3 ||
    width > 2048 ||
    height > 2048 ||
    rgba.length !== width * height * 4
  )
    throw Error("Invalid detection image.");
  const config =
    sensitivity === "dense"
      ? { warm: 15, bright: 200, density: 0.6 }
      : sensitivity === "broad"
        ? { warm: 5, bright: 218, density: 0.34 }
        : { warm: 12, bright: 205, density: 0.5 };
  const stride = width + 1,
    integral = new Uint32Array((width + 1) * (height + 1)),
    canopy = new Uint8Array(width * height),
    roadCandidates = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        r = rgba[i],
        g = rgba[i + 1],
        b = rgba[i + 2];
      const opaque = rgba[i + 3] >= 240;
      // Weak canopy evidence allows mixed edge pixels, but density must never
      // invent cover on gray roads, grass, snow, roofs or transparent pixels.
      canopy[y * width + x] = Number(
        opaque && r - g > 3 && g - b > 24 && r > 65 && r < config.bright,
      );
      // Neutral asphalt and muted dirt/mixed road-edge pixels. Continuity below
      // avoids treating isolated canopy highlights as road separators.
      roadCandidates[y * width + x] = Number(
        opaque &&
          r > 75 &&
          Math.max(r, g, b) - Math.min(r, g, b) < 60 &&
          Math.abs(r - g) < 25 &&
          Math.abs(g - b) < 40,
      );
      sum += Number(
        opaque &&
          r - g > config.warm &&
          g - b > 32 &&
          r < config.bright &&
          r > 65,
      );
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
    }
  }
  onProgress(35);
  const mask = new Uint8Array(width * height);
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  function roadGap(x: number, y: number): boolean {
    if (!roadCandidates[y * width + x]) return false;
    return directions.some(([dx, dy]) => {
      let support = 0,
        available = 0;
      for (let step = -2; step <= 2; step++) {
        const nx = x + dx * step,
          ny = y + dy * step;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          available++;
          support += roadCandidates[ny * width + nx];
        }
      }
      return available >= 3 && support >= Math.min(4, available);
    });
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const l = Math.max(0, x - 2),
        r = Math.min(width, x + 3),
        t = Math.max(0, y - 2),
        b = Math.min(height, y + 3);
      const count =
        integral[b * stride + r] -
        integral[t * stride + r] -
        integral[b * stride + l] +
        integral[t * stride + l];
      mask[y * width + x] = Number(
        canopy[y * width + x] === 1 &&
          count / ((r - l) * (b - t)) >= config.density &&
          !roadGap(x, y),
      );
    }
  onProgress(60);
  const visited = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length);
  let patches = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0,
      tail = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const i = queue[head++],
        x = i % width;
      const neighbors = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        i - width,
        i + width,
      ];
      for (const n of neighbors)
        if (n >= 0 && n < mask.length && mask[n] && !visited[n]) {
          visited[n] = 1;
          queue[tail++] = n;
        }
    }
    if (tail < 12) for (let i = 0; i < tail; i++) mask[queue[i]] = 0;
    else patches++;
  }
  onProgress(90);
  return { ...encodeMask(mask), patches };
}
