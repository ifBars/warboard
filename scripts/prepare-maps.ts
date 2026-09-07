import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const revision = "c3252c9d24a22d1aad5d3fa4408807aef591bb56";
const base = `https://raw.githubusercontent.com/apollyon-sys/wardogs-calculator/${revision}`;
await mkdir("public/maps", { recursive: true });
await mkdir("work/tiles", { recursive: true });
for (const name of ["bakurani", "ozeti"]) {
  const composites: sharp.OverlayOptions[] = [];
  const jobs = Array.from({ length: 256 }, (_, n) => ({
    x: n % 16,
    y: Math.floor(n / 16),
  }));
  let count = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (jobs.length) {
        const { x, y } = jobs.pop()!;
        const url = `${base}/maps/tiles/${name}/zoom_4/${x}_${y}.webp`;
        const cache = Bun.file(`work/tiles/${name}-${x}-${y}.webp`);
        let input: Buffer;
        if (await cache.exists())
          input = Buffer.from(await cache.arrayBuffer());
        else {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`${response.status}: ${url}`);
          input = Buffer.from(await response.arrayBuffer());
          await Bun.write(cache, input);
        }
        const meta = await sharp(input).metadata();
        if (meta.width !== 256 || meta.height !== 256)
          throw new Error(`Unexpected tile size: ${url}`);
        composites.push({ input, left: x * 256, top: y * 256 });
        if (++count % 64 === 0) console.log(`${name}: ${count}/256 tiles`);
      }
    }),
  );
  await sharp({
    create: { width: 4096, height: 4096, channels: 3, background: "#333" },
  })
    .composite(composites)
    .webp({ quality: 92 })
    .toFile(`public/maps/${name}.webp`);
  console.log(`${name}: assembled 4096 × 4096 terrain raster`);
}
await Bun.write(
  "public/maps/APOLLYON-LICENSE.txt",
  await (await fetch(`${base}/LICENSE`)).text(),
);
