import { test, expect } from "bun:test";
import { decodeGzipFile } from "./compressedData";
test("compressed assets work with raw-file and Content-Encoding servers", async () => {
  const bytes = new TextEncoder().encode("a pinned structure dataset").buffer;
  const zipped = Bun.gzipSync(new Uint8Array(bytes));
  expect(await decodeGzipFile(bytes)).toEqual(bytes);
  expect(await decodeGzipFile(Uint8Array.from(zipped).buffer)).toEqual(bytes);
  await expect(
    decodeGzipFile(new Uint8Array([31, 139, 0, 0]).buffer),
  ).rejects.toThrow();
});
