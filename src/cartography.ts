import bakurani from "./data/bakurani.json";
import ozeti from "./data/ozeti.json";
import type { Plan, Point } from "./model";

export const maps = { Bakurani: bakurani, Ozeti: ozeti };
export function mapData(map: Plan["map"]) {
  return map.width === 4096 &&
    map.height === 4096 &&
    Object.hasOwn(maps, map.name)
    ? maps[map.name as keyof typeof maps]
    : null;
}
export type Landmark = { name: string; point: Point; kind: string };
export function landmarks(map: Plan["map"]): Landmark[] {
  const data = mapData(map);
  return data
    ? data.markers
        .filter((m) =>
          ["tower", "weapons_vendor", "garage_vendor", "spawn_board"].includes(
            m.icon,
          ),
        )
        .map((m) => ({
          name: m.label,
          point: { x: m.x / 100, y: m.y / 100 },
          kind: m.icon,
        }))
    : [];
}
// Full imagery uses tileBounds, not the smaller playable bounds. Y is north-up.
export function toGame(p: Point, map: Plan["map"]): Point | null {
  const data = mapData(map);
  if (!data) return null;
  const b = data.tileBounds;
  return {
    x: b.minX + (p.x / map.width) * (b.maxX - b.minX),
    y: b.maxY - (p.y / map.height) * (b.maxY - b.minY),
  };
}
export function toPixel(p: Point, map: Plan["map"]): Point | null {
  const data = mapData(map);
  if (!data) return null;
  const b = data.tileBounds;
  return {
    x: ((p.x - b.minX) / (b.maxX - b.minX)) * map.width,
    y: ((b.maxY - p.y) / (b.maxY - b.minY)) * map.height,
  };
}
export function inPlayable(p: Point, map: Plan["map"]) {
  const d = mapData(map);
  if (!d) return false;
  return (
    p.x >= d.bounds.minX &&
    p.x <= d.bounds.maxX &&
    p.y >= d.bounds.minY &&
    p.y <= d.bounds.maxY
  );
}
