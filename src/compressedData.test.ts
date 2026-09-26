import { test, expect } from "bun:test";
import {
  decodeGzipFile,
  decodeTerrainChunk,
  encodeTerrainChunk,
} from "./compressedData";
test("compressed assets work with raw-file and Content-Encoding servers", async () => {
  const bytes = new TextEncoder().encode("a pinned structure dataset").buffer;
  const zipped = Bun.gzipSync(new Uint8Array(bytes));
  expect(await decodeGzipFile(bytes)).toEqual(bytes);
  expect(await decodeGzipFile(Uint8Array.from(zipped).buffer)).toEqual(bytes);
  await expect(
    decodeGzipFile(new Uint8Array([31, 139, 0, 0]).buffer),
  ).rejects.toThrow();
});

test("terrain chunk transform round-trips losslessly", () => {
  const side = 5;
  const raw = new Uint8Array(side * side * 2);
  const view = new DataView(raw.buffer);
  for (let i = 0; i < side * side; i++)
    view.setUint16(i * 2, (i * 7919 + (i % 3 ? 65000 : 3)) & 0xffff, true);
  const encoded = encodeTerrainChunk(raw, side);
  expect(new Uint8Array(decodeTerrainChunk(encoded.buffer, side))).toEqual(raw);
  expect(() => encodeTerrainChunk(raw.subarray(2), side)).toThrow();
  expect(() => decodeTerrainChunk(new ArrayBuffer(4), side)).toThrow();
});
