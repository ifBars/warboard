import sharp from "sharp";
import { mkdir } from "node:fs/promises";
// Rejected watermarked source: research output only, never public app assets.
const root = "work/map-source-research/rejected-terrain-color";
await mkdir(root, { recursive: true });
const manifestFile = Bun.file(`${root}/sources.json`);
const previous = (await manifestFile.exists())
  ? await manifestFile.json()
  : null;
const sources = [];
const hash = (bytes: Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
for (const map of ["bakurani", "ozeti"]) {
  const config = previous?.maps?.find(
    (entry: { id: string }) => entry.id === map,
  );
  if (
    !config ||
    config.baseUrl !== `/wardogs/maps/${map}/tiles/` ||
    !Array.isArray(config.nodes) ||
    config.nodes.length > 336
  )
    throw Error("Missing pinned map configuration.");
  const nodes = config.nodes.sort((a: number[], b: number[]) => a[0] - b[0]);
  for (const node of nodes)
    if (
      !Array.isArray(node) ||
      node.length !== 3 ||
      node.some((v) => !Number.isInteger(v)) ||
      node[0] < 0 ||
      node[0] > 2 ||
      node[1] < 0 ||
      node[2] < 0 ||
      node[1] >= 4 * 2 ** node[0] ||
      node[2] >= 4 * 2 ** node[0]
    )
      throw Error("Invalid pinned source tile.");
  const parts: sharp.OverlayOptions[] = new Array(nodes.length),
    records: object[] = new Array(nodes.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < nodes.length) {
        const i = cursor++,
          [d, x, y] = nodes[i];
        const url = `https://clutchbase.app${config.baseUrl}map_${d}_${x}_${y}.jpg`;
        const cache = `work/map-source-research/tiles/${map}-${d}-${x}-${y}.jpg`;
        const file = Bun.file(cache);
        const bytes = (await file.exists())
          ? new Uint8Array(await file.arrayBuffer())
          : new Uint8Array(
              await (
                await fetch(url).then((r) => {
                  if (!r.ok) throw Error(`${r.status} ${url}`);
                  return r;
                })
              ).arrayBuffer(),
            );
        if (bytes.length > 4 * 1024 * 1024)
          throw Error("Oversized source tile");
        const sha256 = hash(bytes),
          pinned = previous?.sources?.find(
            (s: { url: string }) => s.url === url,
          );
        if (previous && (!pinned || pinned.sha256 !== sha256))
          throw Error(`Source changed: ${url}`);
        const meta = await sharp(bytes).metadata();
        if (meta.width !== 512 || meta.height !== 512)
          throw Error("Unexpected source size");
        await Bun.write(cache, bytes);
        const size = 2048 / 2 ** d;
        parts[i] = {
          input: await sharp(bytes).resize(size, size).toBuffer(),
          left: x * size,
          top: y * size,
        };
        records[i] = { map, url, sha256, bytes: bytes.length };
      }
    }),
  );
  const assembled = await sharp({
    create: { width: 8192, height: 8192, channels: 3, background: "black" },
  })
    .composite(parts)
    .png()
    .toBuffer();
  await sharp(assembled)
    .resize(4096, 4096)
    .webp({ quality: 94 })
    .toFile(`${root}/${map}.webp`);
  await mkdir(`${root}/detail/${map}`, { recursive: true });
  for (let y = 0; y < 16; y++)
    await Promise.all(
      Array.from({ length: 16 }, (_, x) =>
        sharp(assembled)
          .extract({ left: x * 512, top: y * 512, width: 512, height: 512 })
          .webp({ quality: 94 })
          .toFile(`${root}/detail/${map}/${x}_${y}.webp`),
      ),
    );
  sources.push(...records);
  console.log(
    `${map}: ${nodes.length} source tiles, 4096px base and 8192px detail coverage`,
  );
}
await Bun.write(
  manifestFile,
  JSON.stringify(
    {
      source: "Clutchbase base-color imagery",
      captured: "2026-09-07",
      maps: previous.maps,
      outputs: await Promise.all(
        ["bakurani", "ozeti"].map(async (map) => ({
          path: `/maps/terrain-color/${map}.webp`,
          sha256: hash(
            new Uint8Array(await Bun.file(`${root}/${map}.webp`).arrayBuffer()),
          ),
        })),
      ),
      sources,
    },
    null,
    2,
  ),
);
