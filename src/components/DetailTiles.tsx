import type { Plan } from "../model";
import { detailImagery } from "../mapImagery";
import { visibleMap, type Camera, type Viewport } from "../viewport";
export default function DetailTiles({
  map,
  color = false,
  camera,
  viewport,
}: {
  map: Plan["map"];
  color?: boolean;
  camera: Camera;
  viewport: Viewport;
}) {
  const visible = visibleMap(camera, viewport);
  const data = detailImagery(map, color, 1 / visible.unit);
  if (!data || visible.unit > 2) return null;
  const size = map.width / data.count;
  // One tile beyond the viewport avoids gaps during the next pan gesture.
  const x0 = Math.max(0, Math.floor(visible.x / size) - 1),
    x1 = Math.min(
      data.count - 1,
      Math.floor((visible.x + visible.w) / size) + 1,
    );
  const y0 = Math.max(0, Math.floor(visible.y / size) - 1),
    y1 = Math.min(
      data.count - 1,
      Math.floor((visible.y + visible.h) / size) + 1,
    );
  const tiles = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      tiles.push(
        <image
          key={`${data.path}-${x}-${y}`}
          href={`${data.path}/${x}_${y}.webp`}
          x={x * size}
          y={y * size}
          width={size}
          height={size}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />,
      );
  return (
    <g
      data-detail-tiles="true"
      filter="url(#map-brightness)"
      pointerEvents="none"
    >
      {tiles}
    </g>
  );
}
