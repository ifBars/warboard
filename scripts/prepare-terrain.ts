// Verify the checked-in terrain bundle without requesting upstream data.
for (const map of ["bakurani", "ozeti", "zestafona"]) {
  const root = `public/terrain/${map}`;
  const manifestFile = Bun.file(`${root}/manifest.json`);
  if (!(await manifestFile.exists()))
    throw new Error(`Missing local terrain manifest: ${map}`);

  const manifest = (await manifestFile.json()) as {
    format: string;
    mapId: string;
    chunks: Record<string, { file: string; bytes: number; sha256: string }>;
  };
  if (
    manifest.format !== "wardogs-landscape-collision-u16-v1" ||
    manifest.mapId !== map
  )
    throw new Error(`Unexpected local terrain manifest: ${map}`);

  let count = 0;
  for (const chunk of Object.values(manifest.chunks)) {
    if (!/^chunks\/\d+_\d+\.bin$/.test(chunk.file))
      throw new Error(`Invalid terrain chunk path: ${chunk.file}`);

    const file = Bun.file(`${root}/${chunk.file}`);
    if (!(await file.exists()))
      throw new Error(`Missing local terrain chunk: ${map}/${chunk.file}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    if (bytes.length !== chunk.bytes || hash !== chunk.sha256)
      throw new Error(`Terrain integrity mismatch: ${map}/${chunk.file}`);
    count += 1;
  }

  console.log(`${map}: verified ${count} local terrain chunks`);
}

console.log("Local terrain bundle verified; no network requests were made.");
