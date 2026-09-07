import { arrowHead, type Mark, type Plan } from "../model";
import { toGame } from "../cartography";
import { rangeBearing } from "../ballistics";

export default function Shape({
  mark: m,
  selected = false,
  unit = 1,
  map,
}: {
  mark: Mark;
  selected?: boolean;
  unit?: number;
  map?: Plan["map"];
}) {
  const p = m.points[0],
    last = m.points[m.points.length - 1];
  const startGame = map ? toGame(p, map) : null,
    endGame = map ? toGame(last, map) : null;
  const measured =
    startGame && endGame ? rangeBearing(startGame, endGame) : null;
  return (
    <g data-mark={m.id} className="mark">
      {m.type === "note" ? (
        <g transform={`translate(${p.x} ${p.y}) scale(${unit})`}>
          <path d="M0 0 L13 -18" stroke={m.color} strokeWidth="3" />
          <rect
            x="10"
            y="-47"
            width={Math.max(130, Math.min(440, m.text.length * 9 + 30))}
            height="35"
            rx="4"
            fill="#20241f"
            stroke={selected ? "#fff" : m.color}
            strokeWidth="2"
          />
          <text
            x="23"
            y="-24"
            fontFamily="Segoe UI, sans-serif"
            fontSize="17"
            fill={m.color}
          >
            {m.text.length > 44
              ? m.text.slice(0, 43) + "…"
              : m.text || "New note"}
          </text>
          <circle r="5" fill={m.color} />
        </g>
      ) : m.type === "circle" ? (
        <circle
          cx={p.x}
          cy={p.y}
          r={Math.hypot(last.x - p.x, last.y - p.y)}
          fill={`${m.color}1a`}
          stroke={selected ? "#fff" : m.color}
          strokeWidth={m.width * unit}
        />
      ) : (
        <>
          <polyline
            points={m.points.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke="transparent"
            strokeWidth={Math.max(20, m.width + 12) * unit}
            fill="none"
            pointerEvents="stroke"
          />
          {selected && (
            <polyline
              points={m.points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="#fff"
              opacity=".8"
              strokeWidth={(m.width + 5) * unit}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <polyline
            points={m.points.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke={m.color}
            strokeWidth={m.width * unit}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {m.type === "arrow" && (
            <polyline
              points={arrowHead(p, last, m.width * unit)}
              stroke={m.color}
              strokeWidth={m.width * unit}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {m.type === "ruler" && (
            <text
              x={(p.x + last.x) / 2}
              y={(p.y + last.y) / 2 - 12 * unit}
              textAnchor="middle"
              fontFamily="Segoe UI, sans-serif"
              fontSize={19 * unit}
              fill={m.color}
              stroke="#202527"
              strokeWidth={4 * unit}
              paintOrder="stroke"
            >
              {measured
                ? `${Math.round(measured.meters)} m · ${measured.bearing?.toFixed(1) ?? "—"}°`
                : `${Math.round(Math.hypot(last.x - p.x, last.y - p.y))} px · uncalibrated`}
            </text>
          )}
        </>
      )}
    </g>
  );
}
