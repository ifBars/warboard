import catalog from "./data/buildables.json";
import type { Point } from "./model";
export const fobRange = catalog.fobRangeM;
export const buildables = catalog.items;
export type BasePiece = {
  id: string;
  kind: string;
  x: number;
  y: number;
  elevation: number;
  rotation: number;
};
export type BasePlan = { version: 1; anchor: Point; pieces: BasePiece[] };
export const basePiece = (kind: string) =>
  buildables.find((p) => p.id === kind);
export function validBase(value: unknown): value is BasePlan {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("anchor" in value) ||
    !("pieces" in value)
  )
    return false;
  const a = value.anchor;
  if (
    !a ||
    typeof a !== "object" ||
    !("x" in a) ||
    !("y" in a) ||
    ![a.x, a.y].every(
      (n) =>
        typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 163.84,
    )
  )
    return false;
  if (!Array.isArray(value.pieces) || value.pieces.length > 500) return false;
  const ids = new Set<string>();
  return value.pieces.every((p: unknown) => {
    if (
      !p ||
      typeof p !== "object" ||
      !("id" in p) ||
      typeof p.id !== "string" ||
      !/^[\w-]{1,80}$/.test(p.id) ||
      ids.has(p.id) ||
      !("kind" in p) ||
      typeof p.kind !== "string" ||
      !basePiece(p.kind)
    )
      return false;
    ids.add(p.id);
    return (
      "x" in p &&
      "y" in p &&
      "elevation" in p &&
      "rotation" in p &&
      [p.x, p.y, p.elevation, p.rotation].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) &&
      typeof p.x === "number" &&
      Math.abs(p.x) <= 100 &&
      typeof p.y === "number" &&
      Math.abs(p.y) <= 100 &&
      typeof p.elevation === "number" &&
      p.elevation >= 0 &&
      p.elevation <= 80 &&
      typeof p.rotation === "number" &&
      Math.abs(p.rotation) <= 360
    );
  });
}
export function footprint(p: BasePiece): Point[] {
  const b = basePiece(p.kind)!;
  const angle = (p.rotation * Math.PI) / 180;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x:
      p.x +
      ((x * b.width) / 2) * Math.cos(angle) -
      ((y * b.depth) / 2) * Math.sin(angle),
    y:
      p.y +
      ((x * b.width) / 2) * Math.sin(angle) +
      ((y * b.depth) / 2) * Math.cos(angle),
  }));
}
export function baseWarnings(base: BasePlan) {
  const warnings: string[] = [];
  const fobs = base.pieces.filter((p) => p.kind === "fob");
  if (!fobs.length && base.pieces.length)
    warnings.push("Place a FOB to define its build area (60 m each way).");
  if (
    base.pieces.some(
      (p) =>
        p.kind !== "fob" &&
        !fobs.some((f) =>
          footprint(p).every(
            (v) =>
              Math.abs(v.x - f.x) <= fobRange &&
              Math.abs(v.y - f.y) <= fobRange,
          ),
        ),
    )
  )
    warnings.push("Some footprints extend outside the FOB build areas.");
  if (base.pieces.some((p) => p.elevation > 0))
    warnings.push(
      "Elevated pieces need in-game support checks; stacking is not validated.",
    );
  return warnings;
}
