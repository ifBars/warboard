import { assetUrl } from "./assetUrl";
import { mapData } from "./cartography";
import type { Plan } from "./model";
// Community originals only. Rejected site imagery must never be selected here.
export const terrainColorAvailable = true;
export function mapImage(map: Plan["map"], color: boolean) {
  const data = mapData(map);
  return terrainColorAvailable && color && data
    ? assetUrl(`/maps/community-color/${data.id}.webp`)
    : map.image;
}
export function detailImagery(
  map: Plan["map"],
  color: boolean,
  pixelsPerUnit = 1,
) {
  const data = mapData(map);
  if (!data) return null;
  if (terrainColorAvailable && color) {
    const maxLevel = data.id === "ozeti" ? 15 : 14;
    const scale = Number.isFinite(pixelsPerUnit)
      ? Math.max(1, pixelsPerUnit)
      : 1;
    const level = Math.min(
      maxLevel,
      Math.max(12, Math.ceil(Math.log2(map.width * scale))),
    );
    return {
      count: 2 ** level / 512,
      path: assetUrl(`/maps/community-color/${data.id}_files/${level - 9}`),
    };
  }
  return { count: 32, path: assetUrl(`/maps/detail/${data.id}`) };
}
