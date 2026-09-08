import { decodeGzipFile } from "./compressedData";
import { assetUrl } from "./assetUrl";
import type { Point } from "./model";
export type TerrainManifest = {
  format: string;
  mapId: string;
  chunkQuads: number;
  verticesPerSide: number;
  chunkXMin: number;
  chunkXMax: number;
  chunkYMin: number;
  chunkYMax: number;
  globalQuadOffsetX: number;
  globalQuadOffsetY: number;
  gameUnitsToLandscapeQuadsX: number;
  gameUnitsToLandscapeQuadsY: number;
  worldZOffsetMeters: number;
  worldZScaleMetersPerLocalUnit: number;
  coverage: {
    gameXMin: number;
    gameXMax: number;
    gameYMin: number;
    gameYMax: number;
  };
  chunks: Record<
    string,
    {
      file: string;
      bytes: number;
      minLocalZ: number;
      maxLocalZ: number;
      sha256: string;
    }
  >;
};
const manifests = new Map<string, Promise<TerrainManifest>>();
const chunks = new Map<string, Promise<DataView>>();
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function locateTerrain(m: TerrainManifest, p: Point) {
  const c = m.coverage;
  if (
    ![p.x, p.y].every(Number.isFinite) ||
    p.x < c.gameXMin ||
    p.x > c.gameXMax ||
    p.y < c.gameYMin ||
    p.y > c.gameYMax
  )
    return null;
  const qx = m.globalQuadOffsetX + p.x * m.gameUnitsToLandscapeQuadsX,
    qy = m.globalQuadOffsetY + p.y * m.gameUnitsToLandscapeQuadsY;
  const cx = clamp(Math.floor(qx / m.chunkQuads), m.chunkXMin, m.chunkXMax),
    cy = clamp(Math.floor(qy / m.chunkQuads), m.chunkYMin, m.chunkYMax);
  return {
    key: `${cx},${cy}`,
    x: clamp(qx - cx * m.chunkQuads, 0, m.chunkQuads),
    y: clamp(qy - cy * m.chunkQuads, 0, m.chunkQuads),
  };
}
// Bilinear decoding follows Apollyon's MIT-licensed terrain-ballistics.js.
export function decodeHeight(
  m: TerrainManifest,
  entry: TerrainManifest["chunks"][string],
  view: DataView,
  x: number,
  y: number,
) {
  const max = m.verticesPerSide - 1,
    x0 = Math.floor(x),
    y0 = Math.floor(y),
    x1 = Math.min(max, x0 + 1),
    y1 = Math.min(max, y0 + 1);
  const height = (x: number, y: number) =>
    m.worldZOffsetMeters +
    (entry.minLocalZ +
      (view.getUint16((y * m.verticesPerSide + x) * 2, true) / 65535) *
        (entry.maxLocalZ - entry.minLocalZ)) *
      m.worldZScaleMetersPerLocalUnit;
  const top = height(x0, y0) + (height(x1, y0) - height(x0, y0)) * (x - x0);
  const bottom = height(x0, y1) + (height(x1, y1) - height(x0, y1)) * (x - x0);
  return top + (bottom - top) * (y - y0);
}
async function manifestFor(map: string) {
  if (!["bakurani", "ozeti"].includes(map))
    throw new Error("Terrain is available for built-in maps only.");
  let promise = manifests.get(map);
  if (!promise) {
    promise = (async () => {
      const r = await fetch(assetUrl(`/terrain/${map}/manifest.json`));
      if (!r.ok)
        throw new Error(
          "Terrain files are unavailable. The flat-ground calculator still works.",
        );
      const m = (await r.json()) as TerrainManifest;
      if (
        m.format !== "wardogs-landscape-collision-u16-v1" ||
        m.mapId !== map ||
        m.verticesPerSide !== 511 ||
        m.chunkQuads !== 510 ||
        !m.coverage ||
        !m.chunks
      )
        throw new Error("Unsupported terrain dataset.");
      return m;
    })();
    manifests.set(map, promise);
    promise.catch(() => manifests.delete(map));
  }
  return promise;
}
async function heightAt(map: string, m: TerrainManifest, p: Point) {
  const location = locateTerrain(m, p);
  if (!location)
    throw new Error("Part of this route is outside terrain-data coverage.");
  const entry = m.chunks[location.key];
  if (!entry || !/^chunks\/\d+_\d+\.bin$/.test(entry.file))
    throw new Error("Terrain chunk unavailable.");
  const key = `${map}/${entry.file}`;
  let job = chunks.get(key);
  if (!job) {
    job = (async () => {
      const r = await fetch(
        assetUrl(
          `/terrain/${key}${import.meta.env.VITE_COMPRESSED_TERRAIN === "true" ? ".gz" : ""}`,
        ),
      );
      if (!r.ok)
        throw new Error(
          "Could not load terrain. Try again while the local server is running.",
        );
      const bytes =
        import.meta.env.VITE_COMPRESSED_TERRAIN === "true"
          ? await decodeGzipFile(await r.arrayBuffer())
          : await r.arrayBuffer();
      if (bytes.byteLength !== entry.bytes)
        throw new Error("Terrain file size mismatch.");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== entry.sha256)
        throw new Error("Terrain file integrity check failed.");
      return new DataView(bytes);
    })();
    chunks.set(key, job);
    job.catch(() => chunks.delete(key));
    if (chunks.size > 32) chunks.delete(chunks.keys().next().value!);
  }
  return decodeHeight(m, entry, await job, location.x, location.y);
}
export async function terrainHeights(map: string, points: Point[]) {
  if (points.length > 50000) throw new Error("Terrain request is too large.");
  const id = map.toLowerCase(),
    manifest = await manifestFor(id);
  const result: number[] = [];
  // Bounded batches prevent thousands of simultaneous fetches and hashing jobs.
  for (let i = 0; i < points.length; i += 256)
    result.push(
      ...(await Promise.all(
        points.slice(i, i + 256).map((p) => heightAt(id, manifest, p)),
      )),
    );
  return result;
}
export async function terrainProfile(map: string, a: Point, b: Point) {
  const manifest = await manifestFor(map.toLowerCase());
  return Promise.all(
    Array.from({ length: 33 }, (_, i) => {
      const t = i / 32;
      return heightAt(map.toLowerCase(), manifest, {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }),
  );
}
