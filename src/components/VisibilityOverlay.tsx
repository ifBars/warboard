import { toPixel } from "../cartography";
import type { Mark, Plan } from "../model";
import { geometryKey, type Analysis } from "../visibilityAnalysis";

export default function VisibilityOverlay({
  analysis,
  marks,
  map,
  unit,
  layer,
}: {
  analysis: Analysis | null;
  marks: Mark[];
  map: Plan["map"];
  unit: number;
  layer: "under" | "over";
}) {
  const mark = analysis && marks.find((m) => m.id === analysis.markId);
  if (!analysis || !mark || geometryKey(mark) !== analysis.key) return null;
  const a = mark.points[0],
    b = mark.points[mark.points.length - 1];
  if (analysis.kind === "coverage") {
    if (layer !== "under") return null;
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    return (
      <image
        className="coverage-overlay"
        href={analysis.image}
        x={a.x - r}
        y={a.y - r}
        width={r * 2}
        height={r * 2}
        preserveAspectRatio="none"
        pointerEvents="none"
      />
    );
  }
  if (layer !== "over") return null;
  const blocker = analysis.result.blocker && toPixel(analysis.result.blocker.point, map);
  const width = 4 * unit,
    size = 9 * unit;
  return (
    <g pointerEvents="none" className="sight-overlay">
      <line
        x1={a.x}
        y1={a.y}
        x2={blocker?.x ?? b.x}
        y2={blocker?.y ?? b.y}
        stroke="#8fd48a"
        strokeWidth={width}
        strokeLinecap="round"
      />
      {blocker && (
        <>
          <line
            x1={blocker.x}
            y1={blocker.y}
            x2={b.x}
            y2={b.y}
            stroke="#ed796a"
            strokeWidth={width}
            strokeDasharray={`${width * 2} ${width * 1.5}`}
          />
          <path
            d={`M${blocker.x - size},${blocker.y - size}L${blocker.x + size},${blocker.y + size}M${blocker.x + size},${blocker.y - size}L${blocker.x - size},${blocker.y + size}`}
            stroke="#20241f"
            strokeWidth={width * 2}
            strokeLinecap="round"
          />
          <path
            d={`M${blocker.x - size},${blocker.y - size}L${blocker.x + size},${blocker.y + size}M${blocker.x + size},${blocker.y - size}L${blocker.x - size},${blocker.y + size}`}
            stroke="#ed796a"
            strokeWidth={width}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}
