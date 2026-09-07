// Derivative of the existing pinned terrain dataset; no additional game access.
import {
  decodeHeight,
  locateTerrain,
  type TerrainManifest,
} from "../src/terrain";
import { createHash } from "node:crypto";
for (const map of ["bakurani", "ozeti"]) {
  const root = `public/terrain/${map}`;
  const manifest: TerrainManifest = await Bun.file(
    `${root}/manifest.json`,
  ).json();
  const cache = new Map<string, DataView>();
  const {
    gameXMin: minX,
    gameXMax: maxX,
    gameYMin: minY,
    gameYMax: maxY,
  } = manifest.coverage;
  const size = 257,
    heights: number[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const location = locateTerrain(manifest, {
        x: minX + ((maxX - minX) * x) / (size - 1),
        y: maxY - ((maxY - minY) * y) / (size - 1),
      });
      if (!location) throw new Error("Missing preview coverage");
      const entry = manifest.chunks[location.key];
      let view = cache.get(location.key);
      if (!view) {
        const bytes = await Bun.file(`${root}/${entry.file}`).arrayBuffer();
        if (
          createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !==
          entry.sha256
        )
          throw new Error("Terrain integrity mismatch");
        view = new DataView(bytes);
        cache.set(location.key, view);
      }
      heights.push(
        Math.round(
          decodeHeight(manifest, entry, view, location.x, location.y) * 100,
        ) / 100,
      );
    }
  await Bun.write(
    `${root}/preview.json`,
    JSON.stringify({ version: 1, size, minX, maxX, minY, maxY, heights }),
  );
  console.log(
    `${map}: ${size} × ${size} preview, north-up, source hashes verified`,
  );
}
