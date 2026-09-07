import { mkdir } from "node:fs/promises";
const revision = "c3252c9d24a22d1aad5d3fa4408807aef591bb56";
const base = `https://raw.githubusercontent.com/apollyon-sys/wardogs-calculator/${revision}/data/terrain`;
for (const map of ["bakurani", "ozeti"]) {
  const root = `public/terrain/${map}`;
  await mkdir(`${root}/chunks`, { recursive: true });
  const response = await fetch(`${base}/${map}/manifest.json`);
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest = (await response.json()) as {
    format: string;
    mapId: string;
    chunks: Record<string, { file: string; bytes: number; sha256: string }>;
  };
  if (
    manifest.format !== "wardogs-landscape-collision-u16-v1" ||
    manifest.mapId !== map
  )
    throw new Error("Unexpected terrain manifest");
  const jobs = Object.values(manifest.chunks);
  let count = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (jobs.length) {
        const chunk = jobs.pop()!;
        if (!/^chunks\/\d+_\d+\.bin$/.test(chunk.file))
          throw new Error("Invalid chunk path");
        const file = Bun.file(`${root}/${chunk.file}`);
        let bytes: Uint8Array;
        if (await file.exists())
          bytes = new Uint8Array(await file.arrayBuffer());
        else {
          const res = await fetch(`${base}/${map}/${chunk.file}`);
          if (!res.ok) throw new Error(`Chunk HTTP ${res.status}`);
          bytes = new Uint8Array(await res.arrayBuffer());
        }
        const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        if (bytes.length !== chunk.bytes || hash !== chunk.sha256)
          throw new Error(`Integrity mismatch ${map}/${chunk.file}`);
        if (!(await file.exists())) await Bun.write(file, bytes);
        if (++count % 64 === 0)
          console.log(`${map}: ${count}/256 terrain chunks verified`);
      }
    }),
  );
  await Bun.write(`${root}/manifest.json`, JSON.stringify(manifest));
}
console.log("Public terrain data ready; no game files accessed.");
