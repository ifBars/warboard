/** Fetch can transparently decode gzip when a server sets Content-Encoding. */
export async function decodeGzipFile(
  received: ArrayBuffer,
): Promise<ArrayBuffer> {
  const header = new Uint8Array(received, 0, Math.min(2, received.byteLength));
  return header[0] === 0x1f && header[1] === 0x8b
    ? new Response(
        new Blob([received])
          .stream()
          .pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer()
    : received;
}

// Terrain chunks are square little-endian u16 grids. Predicting each sample
// from its left neighbour (the first column from the row above) and storing
// low and high bytes as separate planes roughly halves the gzip size. The
// transform is lossless; callers still verify the reconstructed SHA-256.
export function encodeTerrainChunk(raw: Uint8Array, side: number) {
  const n = side * side;
  if (raw.byteLength !== n * 2)
    throw new Error("Unexpected terrain chunk size.");
  const out = new Uint8Array(n * 2);
  const at = (i: number) => raw[i * 2] | (raw[i * 2 + 1] << 8);
  for (let i = 0; i < n; i++) {
    const prediction = i % side ? at(i - 1) : i >= side ? at(i - side) : 0;
    const delta = (at(i) - prediction) & 0xffff;
    out[i] = delta & 0xff;
    out[n + i] = delta >> 8;
  }
  return out;
}
export function decodeTerrainChunk(encoded: ArrayBuffer, side: number) {
  const n = side * side,
    planes = new Uint8Array(encoded);
  if (planes.byteLength !== n * 2)
    throw new Error("Terrain file size mismatch.");
  const values = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const prediction =
      i % side ? values[i - 1] : i >= side ? values[i - side] : 0;
    values[i] = (prediction + (planes[i] | (planes[n + i] << 8))) & 0xffff;
  }
  const out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[i * 2] = values[i] & 0xff;
    out[i * 2 + 1] = values[i] >> 8;
  }
  return out.buffer;
}
