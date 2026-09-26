// Hillshade and contour lines from the derived bare-ground grid (row 0 north).
// Contours are unlabelled: the elevation datum is offset, so only relative
// spacing is meaningful.

/** Greyscale lambert shading; white is flat or sunlit, suitable for multiply. */
export function hillshade(
  ground: Float32Array,
  size: number,
  cellMeters: number,
  { azimuth = 315, altitude = 45, exaggeration = 2 } = {},
) {
  const out = new Uint8ClampedArray(size * size * 4);
  const az = ((360 - azimuth + 90) * Math.PI) / 180,
    alt = (altitude * Math.PI) / 180;
  const at = (c: number, r: number) =>
    ground[
      Math.min(size - 1, Math.max(0, r)) * size + Math.min(size - 1, Math.max(0, c))
    ];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const dzdx =
        ((at(c + 1, r) - at(c - 1, r)) / (2 * cellMeters)) * exaggeration;
      // Horn/ESRI convention: dz/dy is measured southward (rows increase south).
      const dzdy =
        ((at(c, r + 1) - at(c, r - 1)) / (2 * cellMeters)) * exaggeration;
      const slope = Math.atan(Math.hypot(dzdx, dzdy)),
        aspect = Math.atan2(dzdy, -dzdx);
      const light =
        Math.sin(alt) * Math.cos(slope) +
        Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect);
      // Lift the midtones so flat ground stays close to white under multiply.
      const v = 255 * Math.min(1, Math.max(0, 0.25 + light * 0.95));
      const i = (r * size + c) * 4;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = Math.min(255, v + 6);
      out[i + 3] = 255;
    }
  return out;
}

export type Contours = {
  /** x1, y1, x2, y2 in grid cell units, then a 1 for index lines. */
  segments: Float32Array;
  interval: number;
};

// Marching squares over cell corners at each interval.
export function contours(
  ground: Float32Array,
  size: number,
  interval = 20,
  indexEvery = 5,
): Contours {
  let low = Infinity;
  for (const h of ground) low = Math.min(low, h);
  const out: number[] = [];
  const lerp = (a: number, b: number, level: number) =>
    a === b ? 0.5 : (level - a) / (b - a);
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) {
      const tl = ground[r * size + c],
        tr = ground[r * size + c + 1],
        br = ground[(r + 1) * size + c + 1],
        bl = ground[(r + 1) * size + c];
      const min = Math.min(tl, tr, br, bl),
        max = Math.max(tl, tr, br, bl);
      for (
        let level = Math.ceil(min / interval) * interval;
        level < max;
        level += interval
      ) {
        const index =
          Math.round((level - Math.floor(low / interval) * interval) / interval) %
            indexEvery ===
          0
            ? 1
            : 0;
        // Edge crossings: top, right, bottom, left.
        const points: number[] = [];
        if (tl < level !== tr < level)
          points.push(c + lerp(tl, tr, level), r);
        if (tr < level !== br < level)
          points.push(c + 1, r + lerp(tr, br, level));
        if (bl < level !== br < level)
          points.push(c + lerp(bl, br, level), r + 1);
        if (tl < level !== bl < level)
          points.push(c, r + lerp(tl, bl, level));
        if (points.length === 4) out.push(...points, index);
        else if (points.length === 8) {
          // Saddle: pair crossings by the cell centre value.
          const centre = (tl + tr + br + bl) / 4;
          if (centre < level === tl < level)
            out.push(points[0], points[1], points[2], points[3], index,
              points[4], points[5], points[6], points[7], index);
          else
            out.push(points[0], points[1], points[6], points[7], index,
              points[2], points[3], points[4], points[5], index);
        }
      }
    }
  return { segments: Float32Array.from(out), interval };
}
