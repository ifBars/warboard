import { landmarks, toPixel, type Landmark } from "../cartography";
import type { Plan, Point } from "../model";
import type { LayerSettings } from "./ReferenceLayer";
import { towerIconUrl } from "../towerIcon";

export default function LandmarkMarkers({
  map,
  layers,
  unit,
  onSelect,
  onCluster,
}: {
  map: Plan["map"];
  layers: LayerSettings;
  unit: number;
  onSelect: (landmark: Landmark) => void;
  onCluster?: (center: Point, span: number) => void;
}) {
  const remaining = landmarks(map).filter((m) =>
    m.kind === "tower" ? layers.towers : layers.vendors,
  );
  const groups: Landmark[][] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    if (onCluster) {
      for (let i = 0; i < group.length; i++) {
        const a = toPixel(group[i].point, map)!;
        for (let j = remaining.length - 1; j >= 0; j--) {
          const b = toPixel(remaining[j].point, map)!;
          if (
            (group[i].kind === "tower") === (remaining[j].kind === "tower") &&
            Math.hypot(a.x - b.x, a.y - b.y) < unit * 34
          )
            group.push(remaining.splice(j, 1)[0]);
        }
      }
    }
    groups.push(group);
  }
  return groups.map((group) => {
    const m = group[0],
      tower = m.kind === "tower",
      cluster = group.length > 1;
    const points = group.map((item) => toPixel(item.point, map)!);
    const p = {
      x: points.reduce((sum, item) => sum + item.x, 0) / points.length,
      y: points.reduce((sum, item) => sum + item.y, 0) / points.length,
    };
    const label = cluster
      ? `${group.length} ${tower ? "towers" : "services"}, zoom to separate`
      : `${m.name}, X ${m.point.x.toFixed(2)}, Y ${m.point.y.toFixed(2)}`;
    const activate = () => {
      if (!cluster || !onCluster) return onSelect(m);
      const span =
        Math.max(...points.map((item) => item.x)) -
        Math.min(...points.map((item) => item.x));
      const height =
        Math.max(...points.map((item) => item.y)) -
        Math.min(...points.map((item) => item.y));
      onCluster(p, Math.max(span, height));
    };
    return (
      <g
        key={group
          .map((item) => `${item.kind}:${item.point.x}:${item.point.y}`)
          .sort()
          .join("|")}
        transform={`translate(${p.x},${p.y}) scale(${unit})`}
        role="button"
        tabIndex={0}
        aria-label={label}
        className="landmark"
        onPointerDown={(e) => {
          if (e.pointerType !== "touch" && e.button === 0) e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          activate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            activate();
          }
        }}
      >
        <title>{label}</title>
        {tower ? (
          <g>
            <image href={towerIconUrl} x="-22" y="-22" width="44" height="44" />
            <circle cx="14" cy="14" r="9" fill="#151b1e" stroke="#a6dce5" />
            <text
              x="14"
              y="17.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#a6dce5"
            >
              {cluster ? `${group.length}+` : m.name.replace(/^Tower\s*/i, "")}
            </text>
          </g>
        ) : (
          <>
            <circle
              r={cluster ? 17 : tower ? 13 : 10}
              fill="#202729"
              stroke={tower ? "#f3d384" : "#b8d7c7"}
              strokeWidth="2"
            />
            <text
              y="4"
              textAnchor="middle"
              fontSize={tower || cluster ? 14 : 11}
              fontWeight="600"
              fill={tower ? "#f3d384" : "#b8d7c7"}
            >
              {cluster
                ? `${group.length}+`
                : tower
                  ? m.name.replace("Tower ", "T")
                  : m.kind === "weapons_vendor"
                    ? "W"
                    : m.kind === "garage_vendor"
                      ? "G"
                      : "S"}
            </text>
          </>
        )}
        {!tower && (cluster || unit < 1.5) && (
          <text
            y={cluster ? 33 : -21}
            textAnchor="middle"
            fontSize="13"
            fill="#f4f2e9"
            stroke="#202729"
            strokeWidth="4"
            paintOrder="stroke"
          >
            {cluster ? (tower ? "Towers" : "Services") : m.name}
          </text>
        )}
      </g>
    );
  });
}
