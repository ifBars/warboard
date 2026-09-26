import { useCallback, useSyncExternalStore } from "react";
import { toPixel } from "../cartography";
import type { Plan } from "../model";
import { contours, hillshade } from "../relief";
import { loadFeatures } from "../terrainFeatures";

type Relief =
  | { state: "loading" }
  | { state: "ready"; shade: string; lines: string; span: number }
  | { state: "error"; message: string };
const cache = new Map<string, Relief>();
const listeners = new Set<() => void>();
const publish = (map: string, value: Relief) => {
  cache.set(map, value);
  listeners.forEach((notify) => notify());
};

async function canvasUrl(
  size: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Relief needs canvas support.");
  draw(context);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw Error("Could not draw relief.");
  return URL.createObjectURL(blob);
}

async function build(map: string) {
  const f = await loadFeatures(map);
  const n = f.groundSize,
    cell = (f.span * 100) / n;
  const shade = await canvasUrl(n, (c) =>
    c.putImageData(new ImageData(hillshade(f.ground, n, cell), n, n), 0, 0),
  );
  const { segments } = contours(f.ground, n, 20, 5);
  const scale = 2,
    size = n * scale;
  const lines = await canvasUrl(size, (c) => {
    for (const index of [0, 1]) {
      const path = new Path2D();
      for (let i = 0; i < segments.length; i += 5) {
        if (segments[i + 4] !== index) continue;
        // Grid values sit at cell centres.
        path.moveTo(
          (segments[i] + 0.5) * scale,
          (segments[i + 1] + 0.5) * scale,
        );
        path.lineTo(
          (segments[i + 2] + 0.5) * scale,
          (segments[i + 3] + 0.5) * scale,
        );
      }
      c.strokeStyle = index
        ? "rgba(92, 64, 30, 0.8)"
        : "rgba(110, 82, 44, 0.45)";
      c.lineWidth = index ? 1.6 : 0.8;
      c.stroke(path);
    }
  });
  return { shade, lines, span: f.span };
}

/** Hillshade and 20 m contours (index every 100 m) for built-in maps. */
export default function ReliefLayer({ map }: { map: Plan["map"] }) {
  const name = map.name;
  const subscribe = useCallback(
    (notify: () => void) => {
      listeners.add(notify);
      if (!cache.has(name)) {
        publish(name, { state: "loading" });
        build(name).then(
          (ready) => publish(name, { state: "ready", ...ready }),
          (e: unknown) =>
            publish(name, {
              state: "error",
              message: e instanceof Error ? e.message : "Relief unavailable.",
            }),
        );
      }
      return () => listeners.delete(notify);
    },
    [name],
  );
  const relief = useSyncExternalStore(subscribe, () => cache.get(name));
  if (relief?.state !== "ready") return null;
  const tl = toPixel({ x: 0, y: relief.span }, map),
    br = toPixel({ x: relief.span, y: 0 }, map);
  if (!tl || !br) return null;
  const box = { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  return (
    <g className="relief-layer" pointerEvents="none">
      <image
        href={relief.shade}
        {...box}
        preserveAspectRatio="none"
        style={{ mixBlendMode: "multiply" }}
        opacity={0.6}
      />
      <image href={relief.lines} {...box} preserveAspectRatio="none" />
    </g>
  );
}
