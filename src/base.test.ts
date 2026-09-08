import { describe, test, expect } from "bun:test";
import {
  basePiece,
  footprint,
  validBase,
  baseWarnings,
  type BasePlan,
} from "./base";
import { validatePlan, type Plan } from "./model";
const base = (): BasePlan => ({
  version: 1,
  anchor: { x: 81.6, y: 81.6 },
  pieces: [{ id: "fob-1", kind: "fob", x: 0, y: 0, elevation: 0, rotation: 0 }],
});
describe("Base plan boundary", () => {
  test("portable plans retain editable base pieces", () => {
    const plan: Plan = {
      version: 1,
      name: "Base",
      map: {
        name: "Custom",
        image: "data:image/png;base64,YQ==",
        width: 100,
        height: 100,
      },
      marks: [],
      base: base(),
    };
    expect(validatePlan(JSON.parse(JSON.stringify(plan))).base).toEqual(base());
  });
  test("rejects unknown pieces, duplicate ids, nonfinite and out-of-bounds edits", () => {
    for (const patch of [
      { kind: "<script>" },
      { x: Infinity },
      { y: 101 },
      { elevation: -1 },
      { rotation: 361 },
    ]) {
      const p = base();
      p.pieces[0] = { ...p.pieces[0], ...patch };
      expect(validBase(p)).toBe(false);
    }
    const p = base();
    p.pieces.push({ ...p.pieces[0] });
    expect(validBase(p)).toBe(false);
    expect(validBase({ ...base(), anchor: { x: -1, y: 20 } })).toBe(false);
  });
  test("rotation preserves footprint dimensions and moves around piece center", () => {
    const p = {
      ...base().pieces[0],
      kind: "airraidshelter",
      x: 20,
      y: -10,
      rotation: 90,
    };
    const corners = footprint(p);
    const b = basePiece(p.kind)!;
    expect(
      Math.max(...corners.map((p) => p.x)) -
        Math.min(...corners.map((p) => p.x)),
    ).toBeCloseTo(b.depth);
    expect(corners.reduce((s, p) => s + p.x, 0) / 4).toBeCloseTo(20);
  });
  test("warns about unsupported pieces and build area overflow", () => {
    const p = base();
    expect(baseWarnings(p)).toEqual([]);
    p.pieces.push({
      ...p.pieces[0],
      id: "shelter-1",
      kind: "airraidshelter",
      x: 70,
      elevation: 2,
    });
    expect(baseWarnings(p).length).toBe(2);
  });
});
