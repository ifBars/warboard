import { colorImage, detectForest, type ForestSensitivity } from "./forest";
self.onmessage = async (
  event: MessageEvent<{
    map: "Bakurani" | "Ozeti";
    sensitivity: ForestSensitivity;
  }>,
) => {
  try {
    const { map, sensitivity } = event.data,
      url = colorImage(map);
    if (!url) throw Error("Unsupported map.");
    const response = await fetch(url);
    if (!response.ok)
      throw Error(
        "Color imagery unavailable. Retry when the map is available.",
      );
    const blob = await response.blob();
    if (blob.size > 16 * 1024 * 1024)
      throw Error("Detection image is too large.");
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width !== 5120 || bitmap.height !== 5120) {
      bitmap.close();
      throw Error("Unexpected color map dimensions.");
    }
    const canvas = new OffscreenCanvas(2048, 2048),
      context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw Error("Image analysis unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, 2048, 2048);
    bitmap.close();
    self.postMessage({ progress: 15 });
    const result = detectForest(
      context.getImageData(0, 0, 2048, 2048).data,
      2048,
      2048,
      sensitivity,
      (progress) => self.postMessage({ progress }),
    );
    self.postMessage({
      result: {
        version: 1,
        detectorRevision: 2,
        source: "wardogs-zone-color-v1",
        map,
        size: 2048,
        sensitivity,
        height: 25,
        enabled: true,
        ...result,
      },
    });
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : "Tree detection failed.",
    });
  }
};
