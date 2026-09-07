import { describe, expect, test } from "bun:test";
import { validatePlan, moveMark, type Plan } from "./model";
const fixture = (): Plan => ({
  version: 1,
  name: "Route",
  map: {
    name: "Custom",
    image: "data:image/png;base64,YQ==",
    width: 1000,
    height: 1000,
  },
  marks: [
    {
      id: "route-1",
      type: "arrow",
      color: "#e8bb48",
      width: 5,
      points: [
        { x: 100, y: 200 },
        { x: 400, y: 500 },
      ],
      text: "",
    },
  ],
});
describe("Portable plan boundary", () => {
  test("preserves editable annotations through a JSON round trip", () => {
    const p = fixture();
    expect(validatePlan(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  test("rejects scriptable images and remote URLs", () => {
    for (const image of [
      "data:image/svg+xml;base64,YQ==",
      "https://example.com/map.png",
      "javascript:alert(1)",
    ]) {
      const p = fixture();
      p.map.image = image;
      expect(() => validatePlan(p)).toThrow();
    }
  });
  test("rejects corrupt geometry and duplicate IDs", () => {
    const p = fixture();
    p.marks[0].points[0].x = NaN;
    expect(() => validatePlan(p)).toThrow();
    const q = fixture();
    q.marks.push(q.marks[0]);
    expect(() => validatePlan(q)).toThrow();
  });
  test("rejects unsupported versions and oversized decoded images", () => {
    expect(() => validatePlan({ ...fixture(), version: 2 })).toThrow();
    const p = fixture();
    p.map.width = 8192;
    p.map.height = 8192;
    expect(() => validatePlan(p)).toThrow();
  });
  test("moving a route preserves shape and does not mutate history", () => {
    const p = fixture(),
      original = structuredClone(p);
    const m = moveMark(p.marks[0], { x: -50, y: 75 });
    expect(m.points).toEqual([
      { x: 50, y: 275 },
      { x: 350, y: 575 },
    ]);
    expect(p).toEqual(original);
  });
});
