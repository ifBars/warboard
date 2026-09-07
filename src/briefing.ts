import {
  coordinateText,
  firingSolution,
  formatMil,
  profiles,
  rangeBearing,
} from "./ballistics";
import { toGame } from "./cartography";
import type { Plan } from "./model";
import { resourceNames } from "./operations";

export function planBriefing(plan: Plan) {
  const lines = [
    `${plan.name || "Untitled plan"} — ${plan.map.name}`,
    "WARBOARD · manual planning snapshot",
    "",
  ];
  const ops = plan.operations;
  if (plan.flight?.waypoints.length) {
    lines.push(
      "FLIGHT PATH",
      `Altitude reference: ${plan.flight.mode === "agl" ? "above sampled ground (AGL)" : "absolute terrain elevation; altimeter calibration unverified"}`,
      `Final approach: ${plan.flight.approach?.type ?? "direct"}${plan.flight.approach && plan.flight.approach.type !== "direct" ? `, ${plan.flight.approach.side}, ${plan.flight.approach.size} m turn size` : ""}. Pattern geometry only; no burn timing.`,
      ...(plan.flight.autoTrees
        ? [
            `Automatic tree cover: ${plan.flight.autoTrees.enabled ? "enabled" : "disabled"}, ${plan.flight.autoTrees.sensitivity}, assumed ${plan.flight.autoTrees.height} m canopy; Wardogs Zone color v1 image estimate.`,
          ]
        : []),
      ...(plan.flight.treeAreas ?? []).map(
        (a) =>
          `Manual ${a.kind ?? "trees"}: ${a.name}, assumed canopy ${a.height} m; manually traced, unverified.`,
      ),
      ...plan.flight.waypoints.map(
        (p, i) =>
          `${i + 1}. ${p.name || "Waypoint"} — ${coordinateText(p)} — ${p.altitude} m`,
      ),
      "Manual planned route. Terrain and obstacle clearance must be checked in game.",
      "",
    );
  }
  if (ops?.briefing.trim()) lines.push(ops.briefing.trim(), "");
  if (ops?.tasks.length) {
    lines.push(
      "CHECKLIST",
      ...ops.tasks.map((task) => `[${task.done ? "x" : " "}] ${task.text}`),
      "",
    );
  }
  const notes = plan.marks.filter((mark) => mark.type === "note");
  if (notes.length) {
    lines.push(
      "MAP NOTES",
      ...notes.map((mark) => {
        const point = toGame(mark.points[0], plan.map);
        return `- ${mark.text || "Untitled note"}${point ? ` — ${coordinateText(point)}` : ""}`;
      }),
      "",
    );
  }
  const mission = plan.mission;
  if (mission?.gun || mission?.target || mission?.targets.length) {
    lines.push(
      "FIRE SUPPORT",
      profiles.find((profile) => profile.id === mission.weapon)!.name,
    );
    if (mission.gun) lines.push(`Gun: ${coordinateText(mission.gun)}`);
    if (mission.target) lines.push(`Target: ${coordinateText(mission.target)}`);
    if (mission.gun && mission.target) {
      const { meters, bearing } = rangeBearing(mission.gun, mission.target);
      const solutions = firingSolution(mission.weapon, meters);
      lines.push(
        `${Math.round(meters)} m · bearing ${bearing?.toFixed(1) ?? "—"}°`,
        ...solutions.map(
          (solution) =>
            `${solution.arc === "single" ? "Elevation" : `${solution.arc} arc`}: ${formatMil(solution.mil)} MIL`,
        ),
      );
      if (!solutions.length) lines.push("No supported firing-table solution.");
    }
    if (mission.targets.length)
      lines.push(
        "Queued targets:",
        ...mission.targets.map(
          (target) => `- ${target.name}: ${coordinateText(target.point)}`,
        ),
      );
    lines.push(
      "Flat-ground community estimate. Confirm a ranging shot. Temporary spotter corrections are not included.",
      "",
    );
  }
  if (ops) {
    const resources = resourceNames.filter(
      (name) => ops.supplies[name].required || ops.supplies[name].packed,
    );
    if (resources.length)
      lines.push(
        "SUPPLY RUN",
        ...resources.map((name) => {
          const resource = ops.supplies[name];
          return `- ${name}: ${resource.packed} packed / ${resource.required} requested; ${Math.max(0, resource.required - resource.packed)} short`;
        }),
        "",
      );
  }
  lines.push(
    "Positions and supplies are manually entered. Confirm map, current objectives and friendly positions with your squad.",
  );
  return lines.join("\n");
}
