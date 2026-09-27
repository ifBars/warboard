import { mkdir, rename, rm } from "node:fs/promises";
import sharp from "sharp";

const input = process.argv[2];
if (!input) {
  throw new Error(
    'Pass the local source file, for example: bun run maps:zestafona-color "C:/Users/you/Downloads/zesty_map.png"',
  );
}

const options = { limitInputPixels: 1_100_000_000, sequentialRead: true };
const metadata = await sharp(input, options).metadata();
if (
  metadata.format !== "png" ||
  metadata.width !== 32768 ||
  metadata.height !== 32768
)
  throw new Error("Expected a 32768 x 32768 PNG source.");

const root = "public/maps/community-color";
const tileDir = `${root}/zestafona_files`;
const hashSource = async () => {
  const hash = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(input).stream()) hash.update(chunk);
  return hash.digest("hex");
};

sharp.cache({ memory: 128, files: 10, items: 50 });
sharp.concurrency(2);
await mkdir(root, { recursive: true });
const hashPromise = hashSource();
await sharp(input, options)
  .flatten({ background: "#fff" })
  .resize(4096, 4096, { fit: "fill" })
  .webp({ quality: 78, effort: 4 })
  .toFile(`${root}/zestafona.webp`);
const sourceHash = await hashPromise;

await rm(tileDir, { recursive: true, force: true });
await sharp(input, options)
  .flatten({ background: "#fff" })
  .resize(8192, 8192, { fit: "fill" })
  .webp({ quality: 60, effort: 4 })
  .tile({ size: 512, overlap: 0, layout: "dz", depth: "onepixel" })
  .toFile(`${root}/zestafona.dz`);

// The viewer's imagery level 12/13 corresponds to the source pyramid folders
// 3/4 (8x8 and 16x16 512px tiles). Lower levels are served by the 4096 overview.
for (let level = 0; level < 12; level++)
  await rm(`${tileDir}/${level}`, { recursive: true, force: true });
await rename(`${tileDir}/12`, `${tileDir}/3`);
await rename(`${tileDir}/13`, `${tileDir}/4`);
await rm(`${root}/zestafona.dzi`, { force: true });
await rm(`${tileDir}/vips-properties.xml`, { force: true });

for (const [folder, expectedCount] of [
  ["3", 64],
  ["4", 256],
] as const) {
  let count = 0;
  for await (const _entry of new Bun.Glob("*.webp").scan({
    cwd: `${tileDir}/${folder}`,
    onlyFiles: true,
  })) count++;
  if (count !== expectedCount)
    throw new Error(
      `Unexpected Zestafona tile count in level ${folder}: ${count}`,
    );
}

await Bun.write(
  `${root}/zestafona-source.json`,
  JSON.stringify(
    {
      filename: "zesty_map.png",
      sourceWidth: 32768,
      sourceHeight: 32768,
      sourceSha256: sourceHash,
      redditPost:
        "https://www.reddit.com/r/WarDogs/comments/1w41e33/hires_images_of_all_3_current_maps_perfect_for/",
      driveFolder:
        "https://drive.google.com/drive/folders/1pL3f1YWoSGDMpMBCqWmywanbetiPBTGZ",
      overviewWidth: 4096,
      overviewWebpQuality: 78,
      detailWidth: 8192,
      detailTileSize: 512,
      detailLevels: [12, 13],
      detailWebpQuality: 60,
      status:
        "User attributes source to the listed community post; the post does not state an asset license",
    },
    null,
    2,
  ),
);
console.log("Zestafona color overview and 8192px detail pyramid prepared locally.");
