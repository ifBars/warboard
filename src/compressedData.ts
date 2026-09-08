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
