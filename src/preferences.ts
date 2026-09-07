import type { LayerSettings } from "./components/ReferenceLayer";
export type ViewPreferences = {
  brightness: number;
  terrainColor: boolean;
  terrainLighting: boolean;
  treeOutlines: boolean;
  grid: boolean;
  rings: boolean;
  layers: LayerSettings;
};
const defaults: ViewPreferences = {
  brightness: 1.5,
  terrainColor: false,
  terrainLighting: true,
  treeOutlines: false,
  grid: false,
  rings: true,
  layers: { towers: true, spawns: false, vendors: false },
};
export function readView(): ViewPreferences {
  try {
    const p = JSON.parse(localStorage.getItem("warboard-view-v1") ?? "null");
    if (!p) return defaults;
    return {
      terrainColor: p.terrainColor === true,
      terrainLighting: p.terrainLighting !== false,
      treeOutlines: p.treeOutlines === true,
      brightness:
        typeof p.brightness === "number" &&
        Number.isFinite(p.brightness) &&
        p.brightness >= 0.6 &&
        p.brightness <= 2.5
          ? p.brightness
          : p.terrainColor === true
            ? 1
            : defaults.brightness,
      grid: typeof p.grid === "boolean" ? p.grid : defaults.grid,
      rings: typeof p.rings === "boolean" ? p.rings : defaults.rings,
      layers: {
        towers: typeof p.layers?.towers === "boolean" ? p.layers.towers : true,
        spawns: typeof p.layers?.spawns === "boolean" ? p.layers.spawns : false,
        vendors:
          typeof p.layers?.vendors === "boolean" ? p.layers.vendors : false,
      },
    };
  } catch {
    return defaults;
  }
}
export function saveView(view: ViewPreferences) {
  try {
    localStorage.setItem("warboard-view-v1", JSON.stringify(view));
  } catch {
    /* View settings remain usable when browser storage is unavailable. */
  }
}
