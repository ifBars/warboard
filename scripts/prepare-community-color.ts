import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Local, user-authorized test. Originals stay in research; no game files used.
const root = "public/maps/community-color";
await mkdir(root, { recursive: true });
sharp.cache({ memory: 128, files: 20, items: 100 });
sharp.concurrency(4);
const sources = [];
for (const [id, fileId, width] of [
  ["bakurani", "1KIGUrOfjvHKEgXMM2rtlym5NxN_TlnT5", 16384],
  ["ozeti", "1cO8HsbjyarjEtKpRrKfUz1mbOizHKvEC", 32768],
]) {
  if (
    typeof id !== "string" ||
    typeof fileId !== "string" ||
    typeof width !== "number"
  )
    throw Error("Invalid source configuration");
  const input = `work/map-source-research/community-${id}.png`;
  const options = { limitInputPixels: 1200000000 };
  const metadata = await sharp(input, options).metadata();
  if (
    metadata.width !== width ||
    metadata.height !== width ||
    metadata.format !== "png"
  )
    throw Error(`Unexpected source dimensions: ${id}`);
  const hash = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(input).stream()) hash.update(chunk);
  await sharp(input, options)
    .removeAlpha()
    .resize(4096)
    .webp({ quality: 94 })
    .toFile(`${root}/${id}.webp`);
  await sharp(input, options)
    .removeAlpha()
    .webp({ quality: 94 })
    .tile({ size: 512, overlap: 0, layout: "dz", depth: "onetile" })
    .toFile(`${root}/${id}.dz`);
  sources.push({
    id,
    width,
    height: width,
    sha256: hash.digest("hex"),
    bytes: Bun.file(input).size,
    url: `https://drive.google.com/file/d/${fileId}/view`,
  });
  console.log(`${id}: ${width}px native tile pyramid complete`);
}
await Bun.write(
  `${root}/sources.json`,
  JSON.stringify(
    {
      source: "Community images shared by u/blahajSupremacy",
      post: "https://www.reddit.com/r/WarDogs/comments/1w41e33/hires_images_of_all_3_current_maps_perfect_for/",
      status: "Local evaluation; artwork redistribution rights unverified",
      sources,
    },
    null,
    2,
  ),
);
