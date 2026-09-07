import { mkdir } from "node:fs/promises";
import sharp from "sharp";
const revision = "c3252c9d24a22d1aad5d3fa4408807aef591bb56";
const base = `https://raw.githubusercontent.com/apollyon-sys/wardogs-calculator/${revision}/maps/tiles`;
for (const map of ["bakurani", "ozeti"]) {
  const root = `public/maps/detail/${map}`;
  await mkdir(root, { recursive: true });
  const jobs = Array.from({ length: 1024 }, (_, n) => ({
    x: n % 32,
    y: Math.floor(n / 32),
  }));
  let count = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (jobs.length) {
        const { x, y } = jobs.pop()!;
        const file = Bun.file(`${root}/${x}_${y}.webp`);
        if (!(await file.exists())) {
          const response = await fetch(`${base}/${map}/zoom_5/${x}_${y}.webp`);
          if (!response.ok)
            throw new Error(`Detail tile HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          const meta = await sharp(bytes).metadata();
          if (meta.width !== 256 || meta.height !== 256)
            throw new Error("Invalid tile size");
          await Bun.write(file, bytes);
        }
        if (++count % 256 === 0)
          console.log(`${map}: ${count}/1024 detail tiles`);
      }
    }),
  );
}
