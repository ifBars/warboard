import { useState } from "react";
import TerrainProfile from "./TerrainProfile";
import QuickRange from "./QuickRange";
import {
  Crosshair,
  MapPin,
  Copy,
  BookmarkPlus,
  X,
  LocateFixed,
} from "lucide-react";
import {
  coordinateText,
  correctedAim,
  emptyMission,
  firingSolution,
  formatMil,
  parseCoordinates,
  profiles,
  rangeBearing,
  type Mission,
  type WeaponId,
} from "../ballistics";
import { inPlayable, mapData } from "../cartography";
import type { Plan, Point } from "../model";

export type Placement = "gun" | "target" | null;
function CoordinateEntry({
  label,
  point,
  onChange,
  onPlace,
  onFocus,
  placing,
  canPlace,
}: {
  label: string;
  point: Point | null;
  onChange: (p: Point | null) => void;
  onPlace: () => void;
  onFocus: () => void;
  placing: boolean;
  canPlace: boolean;
}) {
  const [text, setText] = useState(point ? coordinateText(point) : "");
  const [error, setError] = useState("");
  return (
    <form
      className="coordinate-entry"
      onSubmit={(e) => {
        e.preventDefault();
        const p = parseCoordinates(text);
        if (p) {
          onChange(p);
          setError("");
        } else setError("Enter X and Y, e.g. 80.25, 72.50.");
      }}
    >
      <div className="section-heading">
        <label htmlFor={`coord-${label}`}>{label}</label>
        <div className="inline-actions">
          <button
            type="button"
            title="Center this position"
            aria-label={`Center ${label.toLowerCase()}`}
            disabled={!point || !canPlace}
            onClick={onFocus}
          >
            <LocateFixed size={14} />
          </button>
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            title="Clear this position"
            disabled={!point}
            onClick={() => {
              setText("");
              onChange(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="coordinate-input">
        {/* Labels here are generated from the Gun/Target label. */}
        {/* eslint-disable-next-line de-slop-ui/forms-no-placeholder-only-label */}
        <input
          id={`coord-${label}`}
          aria-label={`${label} coordinates`}
          placeholder="X 80.25, Y 72.50"
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Set</button>
      </div>
      <button
        type="button"
        className={`place-button ${placing ? "placing" : ""}`}
        disabled={!canPlace}
        aria-pressed={placing}
        onClick={onPlace}
      >
        {label === "Gun" ? <MapPin size={15} /> : <Crosshair size={15} />}{" "}
        {placing
          ? `Click the map for ${label.toLowerCase()}`
          : `Place ${label.toLowerCase()} on map`}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function FiringReadout({
  mission,
  mapName,
  calibrated,
  onError,
}: {
  mission: Mission;
  mapName: string;
  calibrated: boolean;
  onError: (s: string) => void;
}) {
  const [over, setOver] = useState("0"),
    [right, setRight] = useState("0"),
    [copied, setCopied] = useState(false);
  const profile = profiles.find((w) => w.id === mission.weapon)!;
  const gun = mission.gun!,
    target = mission.target!;
  const base = rangeBearing(gun, target);
  const correctionValid =
    over.trim() !== "" &&
    right.trim() !== "" &&
    [Number(over), Number(right)].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= 2000,
    );
  const aim = correctionValid
    ? correctedAim(gun, target, Number(over), Number(right))
    : target;
  const corrected = rangeBearing(gun, aim);
  const solutions = correctionValid
    ? firingSolution(mission.weapon, corrected.meters)
    : [];
  const isCorrected =
    correctionValid && (Number(over) !== 0 || Number(right) !== 0);
  const callout = `${mapName} | ${profile.name} | Gun ${coordinateText(gun)} | Target ${coordinateText(target)} | ${Math.round(corrected.meters)} m | Bearing ${corrected.bearing?.toFixed(1) ?? "—"}° | ${solutions.length ? solutions.map((s) => `${s.arc === "single" ? "Elevation" : s.arc + " arc"} ${formatMil(s.mil)} MIL`).join(" / ") : "No firing-table solution"}${isCorrected ? ` | Adjusted aim ${coordinateText(aim)}; observed ${over} m over, ${right} m right` : ""} | Community flat-ground estimate; verify a ranging shot.`;
  return (
    <section className="firing-readout">
      <div className="section-heading">
        <h2>{isCorrected ? "Corrected aim" : "Firing solution"}</h2>
        <span className="source-tag">Estimate</span>
      </div>
      <div className="solution-metrics">
        <div>
          <span>Range</span>
          <strong>
            {Math.round(corrected.meters).toLocaleString()}
            <small> m</small>
          </strong>
        </div>
        <div>
          <span>Bearing</span>
          <strong>
            {corrected.bearing?.toFixed(1) ?? "—"}
            <small>°</small>
          </strong>
        </div>
      </div>
      {solutions.length > 0 ? (
        <div className="elevation-results">
          {solutions.map((s) => (
            <div key={s.arc}>
              <span>{s.arc === "single" ? "Elevation" : `${s.arc} arc`}</span>
              <strong>
                {formatMil(s.mil)} <small>MIL</small>
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="range-warning" role="status">
          {!correctionValid
            ? "Enter a correction between −2,000 and 2,000 m."
            : base.meters < 0.001
              ? "Gun and target are at the same position."
              : `Outside the supported firing table (${profile.min}–${profile.max.toLocaleString()} m).`}
        </p>
      )}
      <p className="estimate-note">
        Flat-ground table. Terrain height, vehicle tilt and playtest changes can
        shift impacts. Confirm with a ranging shot.
      </p>
      {calibrated && (
        <TerrainProfile
          map={mapName}
          gun={gun}
          target={target}
          distance={base.meters}
        />
      )}
      <details className="correction">
        <summary>Correct a spotting round</summary>
        <p>
          Observed miss from gun toward target. Positive means over / right;
          negative means short / left. Corrections are not cumulative.
        </p>
        <div className="correction-fields">
          <label>
            Over / short (m)
            <input
              aria-label="Observed over or short meters"
              type="number"
              min={-2000}
              max={2000}
              value={over}
              onChange={(e) => {
                setOver(e.target.value);
                setCopied(false);
              }}
            />
          </label>
          <label>
            Right / left (m)
            <input
              aria-label="Observed right or left meters"
              type="number"
              min={-2000}
              max={2000}
              value={right}
              onChange={(e) => {
                setRight(e.target.value);
                setCopied(false);
              }}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setOver("0");
            setRight("0");
            setCopied(false);
          }}
        >
          Reset correction
        </button>
        {isCorrected && (
          <p>Aim at {coordinateText(aim)}. Target marker stays fixed.</p>
        )}
      </details>
      <button
        type="button"
        className="copy-callout"
        aria-label="Copy squad callout"
        disabled={!correctionValid || corrected.bearing === null}
        onClick={async () => {
          try {
            if (!navigator.clipboard) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(callout);
            setCopied(true);
          } catch {
            onError(
              "Clipboard unavailable. Select and copy the callout below.",
            );
          }
        }}
      >
        <Copy size={15} />
        {copied ? "Callout copied" : "Copy squad callout"}
      </button>
      <details className="callout-text">
        <summary>View callout text</summary>
        <p>{callout}</p>
      </details>
    </section>
  );
}

export default function FireSupportPanel({
  plan,
  onChange,
  placement,
  onPlace,
  onFocus,
  onError,
  onFrame,
}: {
  plan: Plan;
  onChange: (m: Mission) => void;
  placement: Placement;
  onPlace: (p: Placement) => void;
  onFocus: (p: Point) => void;
  onError: (s: string) => void;
  onFrame: () => void;
}) {
  const [targetName, setTargetName] = useState("");
  const mission = plan.mission ?? emptyMission(),
    calibrated = !!mapData(plan.map);
  const profile = profiles.find((w) => w.id === mission.weapon)!;
  const change = (patch: Partial<Mission>) =>
    onChange({ ...mission, ...patch });
  return (
    <div className="fire-panel">
      <section className="weapon-choice">
        <div className="section-heading">
          <h2>Weapon setup</h2>
          <span className="source-tag">Manual positions</span>
        </div>
        <label htmlFor="weapon">Weapon</label>
        <select
          id="weapon"
          value={mission.weapon}
          onChange={(e) => change({ weapon: e.target.value as WeaponId })}
        >
          {profiles.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p>
          Supported table: {profile.min}–{profile.max.toLocaleString()} m
        </p>
      </section>
      <QuickRange weapon={mission.weapon} />
      {!calibrated && (
        <p className="range-warning">
          This imported map is uncalibrated. Enter in-game coordinates manually;
          map placement is unavailable.
        </p>
      )}
      {(["gun", "target"] as const).map((kind) => (
        <CoordinateEntry
          key={`${kind}-${JSON.stringify(mission[kind])}`}
          label={kind === "gun" ? "Gun" : "Target"}
          point={mission[kind]}
          canPlace={calibrated}
          placing={placement === kind}
          onChange={(p) => change({ [kind]: p })}
          onPlace={() => onPlace(placement === kind ? null : kind)}
          onFocus={() => mission[kind] && onFocus(mission[kind])}
        />
      ))}
      {calibrated &&
        [mission.gun, mission.target].some(
          (p) => p && !inPlayable(p, plan.map),
        ) && (
          <p className="range-warning">
            A position lies outside the community playable bounds. Check your
            coordinates against this match.
          </p>
        )}
      {mission.gun && mission.target ? (
        <>
          <button
            type="button"
            className="frame-mission"
            disabled={!calibrated}
            onClick={onFrame}
          >
            <LocateFixed size={16} />
            Fit gun & target
          </button>
          <FiringReadout
            key={`${mission.weapon}-${JSON.stringify(mission.gun)}-${JSON.stringify(mission.target)}`}
            mission={mission}
            mapName={plan.map.name}
            calibrated={calibrated}
            onError={onError}
          />
        </>
      ) : (
        <p className="fire-empty">
          Set a gun and a target to calculate range, compass bearing and
          elevation.
        </p>
      )}
      <section className="saved-targets">
        <h2>
          Target queue <span>{mission.targets.length}/100</span>
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!mission.target || mission.targets.length >= 100) return;
            change({
              targets: [
                ...mission.targets,
                {
                  id: crypto.randomUUID(),
                  name:
                    targetName.trim() || `Target ${mission.targets.length + 1}`,
                  point: mission.target,
                },
              ],
            });
            setTargetName("");
          }}
        >
          <input
            aria-label="Target name"
            placeholder="Bridge, FOB, ridge…"
            maxLength={80}
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Save current target"
            title="Save current target"
            disabled={!mission.target || mission.targets.length >= 100}
          >
            <BookmarkPlus size={18} />
          </button>
        </form>
        <ol>
          {mission.targets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="saved-target"
                onClick={() => {
                  change({ target: t.point });
                  if (calibrated) onFocus(t.point);
                }}
              >
                <strong>{t.name}</strong>
                <span>{coordinateText(t.point)}</span>
                {mission.gun && (
                  <small>
                    {Math.round(rangeBearing(mission.gun, t.point).meters)} m ·{" "}
                    {firingSolution(
                      mission.weapon,
                      rangeBearing(mission.gun, t.point).meters,
                    ).length
                      ? "In table range"
                      : "Out of table range"}
                  </small>
                )}
              </button>
              <button
                type="button"
                aria-label={`Delete target ${t.name}`}
                title="Delete saved target"
                onClick={() =>
                  change({
                    targets: mission.targets.filter((x) => x.id !== t.id),
                  })
                }
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
        {!mission.targets.length && (
          <p>
            Save named targets to switch quickly while keeping your gun
            position.
          </p>
        )}
      </section>
      <p className="fire-source">
        Community data:{" "}
        <a
          href="https://github.com/apollyon-sys/wardogs-calculator/blob/c3252c9d24a22d1aad5d3fa4408807aef591bb56/data/weapons.json"
          target="_blank"
          rel="noreferrer"
        >
          Apollyon firing tables
        </a>{" "}
        · checked Sep 5, 2026. Not live-tested in this build.
      </p>
    </div>
  );
}
