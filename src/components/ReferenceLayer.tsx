import { factionIcon } from "../factionIcons";
import { mapData, toPixel, type Landmark } from "../cartography";
import type { Plan, Point } from "../model";
import LandmarkMarkers from "./LandmarkMarkers";
export type { Landmark } from "../cartography";
export type LayerSettings = {
  towers: boolean;
  spawns: boolean;
  vendors: boolean;
};
export default function ReferenceLayer({
  map,
  layers,
  unit,
  onSelect,
  onCluster,
}: {
  map: Plan["map"];
  layers: LayerSettings;
  unit: number;
  onSelect: (l: Landmark) => void;
  onCluster?: (center: Point, span: number) => void;
}) {
  const data = mapData(map);
  if (!data) return null;
  return (
    <g className="reference-layer" fontFamily="Segoe UI, sans-serif">
      {layers.spawns &&
        data.polygons.map((poly) => {
          const points = poly.points.map((p) =>
            toPixel({ x: p.x / 100, y: p.y / 100 }, map)!,
          );
          const center = {
            x: points.reduce((n, p) => n + p.x, 0) / points.length,
            y: points.reduce((n, p) => n + p.y, 0) / points.length,
          };
          return (
            <g key={poly.label} pointerEvents="none">
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={poly.color}
                fillOpacity=".14"
                stroke={poly.color}
                strokeWidth={2 * unit}
                strokeDasharray={`${5 * unit} ${4 * unit}`}
              />
              <g aria-label={poly.label}>
                <title>{poly.label}</title>
                <defs>
                  <mask
                    id={`spawn-${poly.label.replace(/\W/g, "-")}`}
                    maskUnits="userSpaceOnUse"
                    x={center.x - 20 * unit}
                    y={center.y - 20 * unit}
                    width={40 * unit}
                    height={40 * unit}
                    style={{ maskType: "alpha" }}
                  >
                    <image
                      href={factionIcon(poly.label)}
                      x={center.x - 20 * unit}
                      y={center.y - 20 * unit}
                      width={40 * unit}
                      height={40 * unit}
                    />
                  </mask>
                </defs>
                <rect
                  x={center.x - 20 * unit}
                  y={center.y - 20 * unit}
                  width={40 * unit}
                  height={40 * unit}
                  fill={poly.color}
                  mask={`url(#spawn-${poly.label.replace(/\W/g, "-")})`}
                />
              </g>
            </g>
          );
        })}
      <LandmarkMarkers
        map={map}
        layers={layers}
        unit={unit}
        onSelect={onSelect}
        onCluster={onCluster}
      />
    </g>
  );
}
