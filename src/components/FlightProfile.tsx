import type { routeAltitudes } from "../flight";
type Sample = ReturnType<typeof routeAltitudes>[number];
export default function FlightProfile({
  samples,
  index,
  onSelect,
}: {
  samples: Sample[];
  index: number;
  onSelect: (index: number) => void;
}) {
  if (samples.length < 2)
    return (
      <div className="flight-profile flight-profile-empty">
        Add two waypoints to see the terrain and flight altitude along your
        route.
      </div>
    );
  const maxDistance = samples.at(-1)!.distance || 1;
  const low =
      Math.min(...samples.map((s) => Math.min(s.ground, s.altitude))) - 30,
    high =
      Math.max(
        ...samples.map((s) =>
          Math.max(s.ground, s.altitude, s.obstacle ?? s.ground),
        ),
      ) + 30;
  const x = (s: Sample) => (s.distance / maxDistance) * 1000,
    y = (height: number) => 130 - ((height - low) / (high - low)) * 115;
  const ground = samples.map((s) => `${x(s)},${y(s.ground)}`).join(" "),
    route = samples.map((s) => `${x(s)},${y(s.altitude)}`).join(" ");
  const obstacles = samples
    .map((s) => `${x(s)},${y(Math.max(s.ground, s.obstacle ?? s.ground))}`)
    .join(" ");
  const hasObstacles = samples.some((s) => s.obstacle !== undefined);
  const selected = samples[Math.min(index, samples.length - 1)];
  return (
    <section className="flight-profile" aria-label="Route elevation profile">
      <div>
        <strong>Route profile</strong>
        <span>
          Ground <i className="ground-key" /> Flight <i className="route-key" />{" "}
          {hasObstacles && (
            <>
              {" "}
              Obstacles <i style={{ background: "#e8bb48" }} />{" "}
            </>
          )}{" "}
          · absolute elevation (m)
        </span>
      </div>
      <svg
        viewBox="0 0 1000 150"
        preserveAspectRatio="none"
        role="img"
        aria-label="Ground elevation and planned flight altitude"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect(),
            distance = ((e.clientX - r.left) / r.width) * maxDistance;
          let closest = 0;
          for (let i = 1; i < samples.length; i++)
            if (
              Math.abs(samples[i].distance - distance) <
              Math.abs(samples[closest].distance - distance)
            )
              closest = i;
          onSelect(closest);
        }}
      >
        <polygon points={`0,150 ${ground} 1000,150`} fill="#3c4948" />
        <polyline
          points={ground}
          fill="none"
          stroke="#a9b4b8"
          strokeWidth="1"
        />
        {hasObstacles && (
          <polyline
            points={obstacles}
            fill="none"
            stroke="#e8bb48"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
        )}
        <polyline points={route} fill="none" stroke="#a6dce5" strokeWidth="2" />
        {samples
          .filter(
            (s) => s.altitude <= Math.max(s.ground, s.obstacle ?? s.ground),
          )
          .map((s, i) => (
            <circle key={i} cx={x(s)} cy={y(s.altitude)} r="3" fill="#ed796a" />
          ))}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1="0"
          y2="150"
          stroke="#e8bb48"
          strokeWidth="1"
        />
      </svg>
      <label className="profile-scrubber">
        Inspect route
        <input
          aria-label="Inspect route position"
          type="range"
          min="0"
          max={samples.length - 1}
          value={Math.min(index, samples.length - 1)}
          onChange={(e) => onSelect(Number(e.target.value))}
        />
      </label>
      <p>
        {(selected.distance / 1000).toFixed(2)} km · ground{" "}
        {selected.ground.toFixed(0)} m · flight {selected.altitude.toFixed(0)} m
        ·{" "}
        <strong>
          {(selected.altitude - selected.ground).toFixed(0)} m terrain clearance
        </strong>
        {selected.obstacle !== undefined && (
          <>
            {" "}
            ·{" "}
            {(
              selected.altitude - Math.max(selected.ground, selected.obstacle)
            ).toFixed(0)}{" "}
            m obstacle clearance (estimated)
          </>
        )}
      </p>
    </section>
  );
}
