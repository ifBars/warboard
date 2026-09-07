import { mkdir } from "node:fs/promises";
import sharp from "sharp";
const maps = [
  {
    name: "bakurani",
    remote: "kavkazi",
    hash: "d054094b642199e9094a5813945b4598b5a876954b77126247fe93c5a87bd819",
  },
  {
    name: "ozeti",
    remote: "europe",
    hash: "ad175fb3be38107d9b49522630c9e549314c0a1e32f99e65f8ffaa97d8523f3f",
  },
];
await mkdir("public/maps/color", { recursive: true });
for (const map of maps) {
  const url = `https://wardogs.zone/game/maps/${map.remote}.webp?v=${map.hash.slice(0, 8)}`,
    file = Bun.file(`public/maps/color/${map.name}.webp`);
  let bytes: ArrayBuffer;
  if (await file.exists()) bytes = await file.arrayBuffer();
  else {
    const response = await fetch(url);
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    bytes = await response.arrayBuffer();
  }
  if (
    bytes.byteLength > 16 * 1024 * 1024 ||
    new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== map.hash
  )
    throw Error(`Color source changed: ${map.name}`);
  const metadata = await sharp(Buffer.from(bytes)).metadata();
  if (metadata.width !== 5120 || metadata.height !== 5120)
    throw Error("Unexpected dimensions.");
  await Bun.write(file, bytes);
  console.log(`${map.name}: pinned color imagery verified`);
}
