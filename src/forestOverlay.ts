import { forestMask, type ForestCover, type ForestBounds } from "./forest";
import { canopyAt, type TreeArea } from "./flight";
export function forestOverlay(
  cover: ForestCover | undefined,
  areas: TreeArea[],
  bounds: ForestBounds,
) {
  if (!cover?.enabled) return null;
  const size = cover.size,
    mask = forestMask(cover).slice();
  for (const area of areas.filter((a) => a.kind === "clearing")) {
    const xs = area.points.map(
        (p) => ((p.x - bounds.minX) / (bounds.maxX - bounds.minX)) * size,
      ),
      ys = area.points.map(
        (p) => ((bounds.maxY - p.y) / (bounds.maxY - bounds.minY)) * size,
      );
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys)));
      y <= Math.min(size - 1, Math.ceil(Math.max(...ys)));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(...xs)));
        x <= Math.min(size - 1, Math.ceil(Math.max(...xs)));
        x++
      ) {
        const p = {
          x: bounds.minX + ((x + 0.5) / size) * (bounds.maxX - bounds.minX),
          y: bounds.maxY - ((y + 0.5) / size) * (bounds.maxY - bounds.minY),
        };
        if (canopyAt(p, [area], 0, "clearing")) mask[y * size + x] = 0;
      }
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(size, size);
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      const x = i % size,
        edge =
          x === 0 ||
          x === size - 1 ||
          !mask[i - 1] ||
          !mask[i + 1] ||
          !mask[i - size] ||
          !mask[i + size];
      const k = i * 4;
      image.data[k] = 113;
      image.data[k + 1] = 222;
      image.data[k + 2] = 111;
      image.data[k + 3] = edge ? 230 : 38;
    }
  context.putImageData(image, 0, 0);
  return { canvas, url: canvas.toDataURL("image/png") };
}
