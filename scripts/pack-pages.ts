import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
for (const path of await files("dist/terrain")) {
  if (!path.endsWith(".bin")) continue;
  await Bun.write(
    `${path}.gz`,
    Bun.gzipSync(await Bun.file(path).arrayBuffer()),
  );
  await unlink(path);
}
await Bun.write("dist/.nojekyll", "");
const bytes = (
  await Promise.all(
    (await files("dist")).map(async (p) => (await stat(p)).size),
  )
).reduce((a, b) => a + b, 0);
console.log(`Pages artifact: ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
if (bytes > 1_000_000_000)
  throw Error("Pages artifact exceeds the 1,000 MB deployment budget.");
