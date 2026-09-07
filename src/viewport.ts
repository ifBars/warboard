export type Camera = { x: number; y: number; w: number; h: number };
export type Viewport = { width: number; height: number };

// SVG uses xMidYMid meet: any letterboxing reveals map space beyond viewBox.
export function visibleMap(camera: Camera, viewport: Viewport) {
  const unit = Math.max(
    camera.w / Math.max(1, viewport.width),
    camera.h / Math.max(1, viewport.height),
  );
  const w = viewport.width * unit;
  const h = viewport.height * unit;
  return {
    x: camera.x + (camera.w - w) / 2,
    y: camera.y + (camera.h - h) / 2,
    w,
    h,
    unit,
  };
}
