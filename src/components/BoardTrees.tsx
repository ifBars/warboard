import { useMemo } from "react";
import type { Plan } from "../model";
import { mapData, toPixel } from "../cartography";
import { forestOverlay } from "../forestOverlay";
export default function BoardTrees({ plan }: { plan: Plan }) {
  const visual = useMemo(() => {
    const data = mapData(plan.map);
    return data
      ? forestOverlay(
          plan.flight?.autoTrees,
          plan.flight?.treeAreas ?? [],
          data.tileBounds,
        )
      : null;
  }, [plan.map, plan.flight?.autoTrees, plan.flight?.treeAreas]);
  return (
    <g pointerEvents="none" aria-label="Estimated tree cover">
      {visual && (
        <image
          href={visual.url}
          width={plan.map.width}
          height={plan.map.height}
        />
      )}
      {(plan.flight?.treeAreas ?? []).map((area) => (
        <polygon
          key={area.id}
          points={area.points
            .map((p) => {
              const q = toPixel(p, plan.map);
              return q ? `${q.x},${q.y}` : "";
            })
            .join(" ")}
          fill={area.kind === "clearing" ? "none" : "#94cf8b"}
          fillOpacity=".15"
          stroke={area.kind === "clearing" ? "#73b7da" : "#94cf8b"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={area.kind === "clearing" ? "5 5" : undefined}
        />
      ))}
    </g>
  );
}
