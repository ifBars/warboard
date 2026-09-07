import { mapData, toPixel } from "../cartography";
import { profiles, rangeBearing } from "../ballistics";
import type { Plan } from "../model";

export default function TacticalOverlay({
  plan,
  grid,
  rings,
  unit,
  interactive = false,
  selected,
  onActivate,
}: {
  plan: Plan;
  grid: boolean;
  rings: boolean;
  unit: number;
  interactive?: boolean;
  selected?: "gun" | "target" | null;
  onActivate?: (field: "gun" | "target") => void;
}) {
  const data = mapData(plan.map);
  if (!data) return null;
  const mission = plan.mission,
    gun = mission?.gun ? toPixel(mission.gun, plan.map) : null,
    target = mission?.target ? toPixel(mission.target, plan.map) : null;
  const weapon = profiles.find((w) => w.id === mission?.weapon);
  const b = data.bounds,
    tl = toPixel({ x: b.minX, y: b.maxY }, plan.map)!,
    br = toPixel({ x: b.maxX, y: b.minY }, plan.map)!;
  const pixelsPerMeter =
    plan.map.width / (data.tileBounds.maxX - data.tileBounds.minX) / 100;
  const range =
    mission?.gun && mission?.target
      ? rangeBearing(mission.gun, mission.target)
      : null;
  return (
    <g
      className="tactical-overlay"
      pointerEvents="none"
      fontFamily="Segoe UI, sans-serif"
    >
      {grid && (
        <g
          stroke="#d6dece"
          strokeOpacity=".24"
          strokeWidth={unit}
          fill="#eef2e7"
          fontSize={12 * unit}
        >
          <rect
            x={tl.x}
            y={tl.y}
            width={br.x - tl.x}
            height={br.y - tl.y}
            fill="none"
            strokeDasharray={`${6 * unit} ${6 * unit}`}
          />
          {Array.from({ length: 17 }, (_, i) => i * 10)
            .filter((n) => n >= b.minX && n <= b.maxX)
            .map((n) => {
              const p = toPixel({ x: n, y: b.maxY }, plan.map)!;
              return (
                <g key={`x${n}`}>
                  <line x1={p.x} x2={p.x} y1={tl.y} y2={br.y} />
                  <text x={p.x + 3 * unit} y={tl.y + 16 * unit} stroke="none">
                    X {n}
                  </text>
                </g>
              );
            })}
          {Array.from({ length: 17 }, (_, i) => i * 10)
            .filter((n) => n >= b.minY && n <= b.maxY)
            .map((n) => {
              const p = toPixel({ x: b.minX, y: n }, plan.map)!;
              return (
                <g key={`y${n}`}>
                  <line x1={tl.x} x2={br.x} y1={p.y} y2={p.y} />
                  <text x={tl.x + 3 * unit} y={p.y - 4 * unit} stroke="none">
                    Y {n}
                  </text>
                </g>
              );
            })}
        </g>
      )}
      {rings && gun && weapon && (
        <g
          stroke="#73b7da"
          strokeWidth={1.5 * unit}
          fill="none"
          strokeDasharray={`${7 * unit} ${5 * unit}`}
        >
          <circle cx={gun.x} cy={gun.y} r={weapon.max * pixelsPerMeter} />
          <circle cx={gun.x} cy={gun.y} r={weapon.min * pixelsPerMeter} />
          {(weapon.max * pixelsPerMeter) / unit > 45 && (
            <text
              x={gun.x}
              y={gun.y - weapon.max * pixelsPerMeter - 8 * unit}
              textAnchor="middle"
              fill="#c6e6f7"
              stroke="#1c1f20"
              strokeWidth={3 * unit}
              paintOrder="stroke"
              fontSize={14 * unit}
            >
              {weapon.max.toLocaleString()} m · table limit
            </text>
          )}
        </g>
      )}
      {gun && target && (
        <g stroke="#e8bb48" strokeWidth={2 * unit}>
          <line
            x1={gun.x}
            y1={gun.y}
            x2={target.x}
            y2={target.y}
            strokeDasharray={`${6 * unit} ${5 * unit}`}
          />
          {range &&
            Math.hypot(target.x - gun.x, target.y - gun.y) / unit > 100 && (
              <text
                x={(gun.x + target.x) / 2}
                y={(gun.y + target.y) / 2 - 12 * unit}
                textAnchor="middle"
                stroke="#1c1f20"
                strokeWidth={4 * unit}
                paintOrder="stroke"
                fill="#f4db92"
                fontSize={17 * unit}
              >
                {Math.round(range.meters)} m ·{" "}
                {range.bearing?.toFixed(1) ?? "—"}°
              </text>
            )}
        </g>
      )}
      {[
        { p: gun, label: "GUN", color: "#73b7da" },
        { p: target, label: "TARGET", color: "#e8bb48" },
      ].map(
        ({ p, label, color }) =>
          p && (
            <g
              key={label}
              data-mission={label === "GUN" ? "gun" : "target"}
              pointerEvents={interactive ? "all" : "none"}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                interactive
                  ? `${label === "GUN" ? "Gun" : "Target"} position, drag to move`
                  : undefined
              }
              aria-pressed={
                interactive ? selected === label.toLowerCase() : undefined
              }
              style={interactive ? { cursor: "grab" } : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onActivate?.(label === "GUN" ? "gun" : "target");
                }
              }}
              transform={`translate(${p.x},${p.y}) scale(${unit})`}
            >
              {interactive && (
                <circle
                  r="23"
                  fill="transparent"
                  stroke={selected === label.toLowerCase() ? "#f4f2e9" : "none"}
                  strokeWidth="1.5"
                />
              )}
              <circle r="12" fill="#202527" stroke={color} strokeWidth="3" />
              <path
                d="M-19 0H-8M8 0H19M0-19V-8M0 8V19"
                stroke={color}
                strokeWidth="2"
              />
              <text
                y={label === "GUN" ? "34" : "-25"}
                textAnchor="middle"
                fill={color}
                stroke="#1c1f20"
                strokeWidth="4"
                paintOrder="stroke"
                fontSize="15"
                fontWeight="600"
              >
                {label}
              </text>
            </g>
          ),
      )}
    </g>
  );
}
