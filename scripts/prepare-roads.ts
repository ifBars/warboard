import sharp from "sharp";
import { createHash } from "node:crypto";
const path = "public/obstacles/manifest.json";
const meta = await Bun.file(path).json();
for (const name of ["bakurani", "ozeti"]) {
  const source = meta.maps[name].roadSource;
  const response = await fetch(source);
  if (!response.ok) throw Error(`Road source unavailable: ${response.status}`);
  await Bun.write(
    `public/obstacles/${name}-roads.webp`,
    await response.arrayBuffer(),
  );
  const raw = await sharp(`public/obstacles/${name}-roads.webp`)
    .resize(2048, 2048)
    .extractChannel("alpha")
    .raw()
    .toBuffer();
  const mask = Uint8Array.from(raw, (a) => (a >= 16 ? 1 : 0));
  await Bun.write(`public/obstacles/${name}-roads.u8.gz`, Bun.gzipSync(mask));
  meta.maps[name].roadHash = createHash("sha256").update(mask).digest("hex");
  meta.maps[name].roadSpan = 163.84;
  meta.maps[name].roadSource =
    `https://wardogs.zone/game/maps/roads/${name === "bakurani" ? "kavkazi.webp?v=8c19e43f" : "europe.webp?v=47590fef"}`;
}
await Bun.write(path, JSON.stringify(meta, null, 2) + "\n");
