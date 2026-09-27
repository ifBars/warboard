import sharp from "sharp";

// Map overviews live in this project's public asset bundle. Validate those
// local copies without fetching tiles from an upstream host.
for (const map of ["bakurani", "ozeti", "zestafona"]) {
  const path = `public/maps/${map}.webp`;
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Missing local map overview: ${path}`);

  const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  if (metadata.width !== 4096 || metadata.height !== 4096)
    throw new Error(`Unexpected map overview dimensions: ${path}`);
  console.log(`${map}: verified local 4096 x 4096 overview`);
}

console.log("Local map overviews verified; no network requests were made.");
