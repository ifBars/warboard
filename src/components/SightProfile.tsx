import type { SightResult } from "../visibility";

// Heights are relative to the observer's ground: the dataset datum is offset,
// so only differences are meaningful.
export default function SightProfile({ result }: { result: SightResult }) {
  const origin = result.eye,
    samples = result.profile;
  const tops = samples.map((s) => Math.max(s.surface, s.canopy ?? -Infinity));
  const low = Math.min(...samples.map((s) => s.surface), result.aim) - 3,
    high = Math.max(...tops, result.eye, result.aim) + 3;
  const x = (d: number) => (d / Math.max(1, result.distance)) * 270,
    y = (h: number) => 100 - ((h - low) / Math.max(1, high - low)) * 88;
  const ground = samples
    .map((s, i) => `${i ? "L" : "M"}${x(s.distance)},${y(s.surface)}`)
    .join(" ");
  const canopy = samples
    .filter((s) => s.canopy !== null && s.canopy > s.surface)
    .map((s) => `M${x(s.distance)},${y(s.surface)}V${y(s.canopy!)}`)
    .join(" ");
  const blocker = result.blocker;
  const lineColor = result.clear ? "#8fd48a" : "#ed796a";
  return (
    <svg
      className="sight-profile"
      viewBox="0 0 270 118"
      role="img"
      aria-label={`Sight profile over ${Math.round(result.distance)} metres. ${result.clear ? "Line of sight is clear." : `Blocked at ${Math.round(blocker!.distance)} metres.`}`}
    >
      <path d={`${ground} L270,104 L0,104 Z`} fill="#859677" fillOpacity=".2" />
      {canopy && (
        <path d={canopy} stroke="#5f9a52" strokeWidth="2" opacity=".75" />
      )}
      <path d={ground} stroke="#aabd96" strokeWidth="1.5" fill="none" />
      <line
        x1="0"
        y1={y(result.eye)}
        x2="270"
        y2={y(result.aim)}
        stroke={lineColor}
        strokeWidth="1.5"
        strokeDasharray={result.clear ? undefined : "4 3"}
      />
      {blocker && (
        <circle
          cx={x(blocker.distance)}
          cy={y(
            result.eye +
              (result.aim - result.eye) * (blocker.distance / result.distance),
          )}
          r="3.5"
          fill="#ed796a"
        />
      )}
      <text x="0" y="116" fill="#b9c1b5" fontSize="9">
        Observer
      </text>
      <text x="270" y="116" textAnchor="end" fill="#b9c1b5" fontSize="9">
        {Math.round(result.distance)} m · Δ height{" "}
        {result.aim - origin >= 0 ? "+" : ""}
        {(result.aim - origin).toFixed(0)} m
      </text>
    </svg>
  );
}
