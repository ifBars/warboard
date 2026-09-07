import { mapImage, detailImagery } from "./mapImagery";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import ExportMap from "./components/ExportMap";
import type { LayerSettings } from "./components/ReferenceLayer";
import type { Plan } from "./model";
import type { Camera } from "./viewport";

async function imageFrom(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export async function exportImage(options: {
  plan: Plan;
  brightness: number;
  terrainColor?: boolean;
  /** Legacy option accepted for compatibility; exports always use the plan terrain. */
  imagery?: "color" | "terrain";
  layers: LayerSettings;
  grid: boolean;
  rings: boolean;
  view?: Camera;
}) {
  const { plan, view, brightness } = options;
  const canvas = document.createElement("canvas");
  const scale = view ? 1920 / Math.max(view.w, view.h) : 1;
  canvas.width = view ? Math.round(view.w * scale) : plan.map.width;
  canvas.height = view ? Math.round(view.h * scale) : plan.map.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create an image canvas.");
  let detailFallbacks = 0;
  {
    context.fillStyle = "#1c2021";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(scale, scale);
    context.translate(-(view?.x ?? 0), -(view?.y ?? 0));
    context.filter = `brightness(${brightness})`;
    context.drawImage(
      await imageFrom(mapImage(plan.map, options.terrainColor ?? false)),
      0,
      0,
      plan.map.width,
      plan.map.height,
    );
    const data = detailImagery(plan.map, options.terrainColor ?? false, scale);
    // Detail imagery is useful when the crop magnifies the base raster.
    if (data && view && scale > 1) {
      const size = plan.map.width / data.count;
      const tiles: { x: number; y: number }[] = [];
      for (
        let y = Math.max(0, Math.floor(view.y / size));
        y <= Math.min(data.count - 1, Math.floor((view.y + view.h) / size));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(view.x / size));
          x <= Math.min(data.count - 1, Math.floor((view.x + view.w) / size));
          x++
        )
          tiles.push({ x, y });
      let next = 0;
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (next < tiles.length) {
            const { x, y } = tiles[next++];
            try {
              const image = await imageFrom(`${data.path}/${x}_${y}.webp`);
              context.drawImage(image, x * size, y * size, size, size);
            } catch {
              detailFallbacks++;
            }
          }
        }),
      );
    }
    context.restore();
  }
  const container = document.createElement("div"),
    root = createRoot(container);
  let markup: string;
  try {
    flushSync(() => root.render(<ExportMap {...options} omitBase />));
    markup = container.innerHTML;
  } finally {
    root.unmount();
  }
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    context.drawImage(await imageFrom(url), 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not generate image.");
    return { blob, detailFallbacks };
  } finally {
    URL.revokeObjectURL(url);
  }
}
