import type { Mission } from "./ballistics";
import { isFlight, type Flight } from "./flight";
import { resourceNames, type Operations } from "./operations";
export type Point = { x: number; y: number };
export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "line"
  | "arrow"
  | "note"
  | "erase"
  | "ruler"
  | "circle";
export type Mark = {
  id: string;
  type: "pen" | "line" | "arrow" | "note" | "ruler" | "circle";
  color: string;
  width: number;
  points: Point[];
  text: string;
};
export type Plan = {
  version: 1;
  name: string;
  map: { name: string; image: string; width: number; height: number };
  marks: Mark[];
  mission?: Mission;
  operations?: Operations;
  flight?: Flight;
};
export const colors = ["#e8bb48", "#ed796a", "#73b7da", "#f4f2e9", "#303a2c"];
export const point = (p: unknown): p is Point =>
  !!p &&
  typeof p === "object" &&
  ["x", "y"].every(
    (k) =>
      typeof (p as Record<string, unknown>)[k] === "number" &&
      Number.isFinite((p as Record<string, number>)[k]) &&
      Math.abs((p as Record<string, number>)[k]) <= 1000000,
  );
export function validatePlan(value: unknown): Plan {
  const p = value as Plan;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    p.name.length > 120 ||
    !p.map ||
    typeof p.map.name !== "string" ||
    p.map.name.length > 200 ||
    typeof p.map.image !== "string" ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.map.image) ||
    p.map.image.length > 30000000 ||
    ![p.map.width, p.map.height].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 8192,
    ) ||
    p.map.width * p.map.height > 25000000 ||
    !Array.isArray(p.marks) ||
    p.marks.length > 2000
  )
    throw new Error("This is not a supported WARBOARD plan.");
  const ids = new Set<string>();
  let total = 0;
  for (const m of p.marks) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !/^[\w-]{1,80}$/.test(m.id) ||
      ids.has(m.id) ||
      !["pen", "line", "arrow", "note", "ruler", "circle"].includes(m.type) ||
      !/^#[0-9a-f]{6}$/i.test(m.color) ||
      !Number.isFinite(m.width) ||
      m.width < 1 ||
      m.width > 20 ||
      typeof m.text !== "string" ||
      m.text.length > 160 ||
      !Array.isArray(m.points) ||
      m.points.length < 1 ||
      m.points.length > 20000 ||
      !m.points.every(point) ||
      (m.type === "note"
        ? m.points.length !== 1
        : m.type !== "pen" && m.points.length !== 2)
    )
      throw new Error("The plan contains invalid annotations.");
    ids.add(m.id);
    total += m.points.length;
  }
  if (total > 200000) throw new Error("This plan has too many drawing points.");
  if (p.mission !== undefined) {
    const m = p.mission;
    const coordinate = (p: unknown) =>
      point(p) &&
      p.x >= -0.03 &&
      p.x <= 163.84 &&
      p.y >= -0.03 &&
      p.y <= 163.84;
    if (
      !m ||
      !["mortar", "spg"].includes(m.weapon) ||
      (m.gun !== null && !coordinate(m.gun)) ||
      (m.target !== null && !coordinate(m.target)) ||
      !Array.isArray(m.targets) ||
      m.targets.length > 100 ||
      m.targets.some(
        (t) =>
          !t ||
          typeof t.id !== "string" ||
          !/^[\w-]{1,80}$/.test(t.id) ||
          typeof t.name !== "string" ||
          t.name.length > 80 ||
          !coordinate(t.point),
      ) ||
      new Set(m.targets.map((t) => t.id)).size !== m.targets.length
    )
      throw new Error("The plan contains invalid fire missions.");
  }
  if (p.operations !== undefined) {
    const o = p.operations;
    const quantity = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e9;
    if (
      !o ||
      typeof o.briefing !== "string" ||
      o.briefing.length > 2000 ||
      !Array.isArray(o.tasks) ||
      o.tasks.length > 30 ||
      o.tasks.some(
        (t) =>
          !t ||
          typeof t.id !== "string" ||
          !/^[\w-]{1,80}$/.test(t.id) ||
          typeof t.text !== "string" ||
          t.text.length > 160 ||
          typeof t.done !== "boolean",
      ) ||
      new Set(o.tasks.map((t) => t.id)).size !== o.tasks.length ||
      !o.supplies ||
      resourceNames.some(
        (r) =>
          !o.supplies[r] ||
          !quantity(o.supplies[r].required) ||
          !quantity(o.supplies[r].packed),
      ) ||
      !o.budget ||
      (["cash", "reserve", "kit", "transport"] as const).some(
        (k) => !quantity(o.budget[k]),
      )
    )
      throw new Error("The plan contains invalid operations data.");
  }
  if (p.flight !== undefined && !isFlight(p.flight))
    throw new Error("The plan contains invalid flight data.");
  if (p.flight?.autoTrees && p.flight.autoTrees.map !== p.map.name)
    throw new Error("Tree detection belongs to a different map.");
  return p;
}
export function arrowHead(a: Point, b: Point, width: number) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    size = width * 4 + 10;
  return `${b.x - size * Math.cos(angle - 0.45)},${b.y - size * Math.sin(angle - 0.45)} ${b.x},${b.y} ${b.x - size * Math.cos(angle + 0.45)},${b.y - size * Math.sin(angle + 0.45)}`;
}
export const moveMark = (m: Mark, delta: Point): Mark => ({
  ...m,
  points: m.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
});
