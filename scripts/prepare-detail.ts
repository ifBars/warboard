import sharp from "sharp";

// Detail tiles are served from this project's own public asset bundle. Keep
// this preparation check offline so builds never bulk-fetch upstream assets.
for (const map of ["bakurani", "ozeti", "zestafona"]) {
  let count = 0;
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const path = `public/maps/detail/${map}/${x}_${y}.webp`;
      const file = Bun.file(path);
      if (!(await file.exists())) throw new Error(`Missing local tile: ${path}`);
      const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
      if (metadata.width !== 256 || metadata.height !== 256)
        throw new Error(`Unexpected tile dimensions: ${path}`);
      count += 1;
    }
  }
  console.log(`${map}: verified ${count} local detail tiles`);
}

console.log("Local detail tiles verified; no network requests were made.");
