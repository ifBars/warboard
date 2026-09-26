import { describe, expect, test } from "bun:test";
import { emptyMission } from "./ballistics";
import type { Plan } from "./model";
import {
  applyShared,
  decodeShare,
  encodeShare,
  sharedFrom,
  simplify,
  tokenFromHash,
} from "./share";

const image = "data:image/webp;base64,AAAA";
const plan = (): Plan => ({
  version: 1,
  name: "Bridge push",
  map: { name: "Bakurani", image, width: 4096, height: 4096 },
  marks: [
    {
      id: "route",
      type: "pen",
      color: "#e8bb48",
      width: 5,
      points: Array.from({ length: 500 }, (_, i) => ({ x: 100 + i, y: 200 })),
      text: "",
    },
    {
      id: "aa",
      type: "marker",
      color: "#ed796a",
      width: 5,
      points: [{ x: 812.345, y: 900.1 }],
      text: "Enemy VERBA?",
      symbol: "antiair",
    },
  ],
  mission: {
    ...emptyMission(),
    gun: { x: 80.123, y: 80.456 },
    target: { x: 81, y: 85 },
  },
});

describe("share links", () => {
  test("round-trip overlays without the map image", async () => {
    const shared = sharedFrom(plan())!;
    const token = await encodeShare(shared);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(600);
    expect(token).not.toContain("AAAA");
    const decoded = await decodeShare(token);
    expect(decoded.map).toBe("Bakurani");
    expect(decoded.marks[0].points).toEqual([
      { x: 100, y: 200 },
      { x: 599, y: 200 },
    ]);
    expect(decoded.marks[1]).toMatchObject({
      symbol: "antiair",
      text: "Enemy VERBA?",
      points: [{ x: 812.3, y: 900.1 }],
    });
    expect(decoded.mission?.gun).toEqual({ x: 80.12, y: 80.46 });
  });
  test("imported maps cannot be shared by link", () => {
    const p = plan();
    p.map.name = "screenshot.png";
    expect(sharedFrom(p)).toBeNull();
  });
  test("rejects tampered, foreign and oversized links", async () => {
    await expect(decodeShare("not base64!")).rejects.toThrow();
    await expect(decodeShare("AAAA")).rejects.toThrow();
    await expect(decodeShare("A".repeat(200_000))).rejects.toThrow();
    const foreign = await encodeShare({
      ...sharedFrom(plan())!,
      map: "Elsewhere" as "Bakurani",
    });
    await expect(decodeShare(foreign)).rejects.toThrow();
    const hostile = await encodeShare({
      ...sharedFrom(plan())!,
      marks: [{ ...plan().marks[1], color: "red;background:url(x)" }],
    });
    await expect(decodeShare(hostile)).rejects.toThrow();
    // A compression bomb stops at the decoded size limit.
    const bomb = await encodeShare({
      ...sharedFrom(plan())!,
      name: "x".repeat(3_000_000),
    });
    await expect(decodeShare(bomb)).rejects.toThrow("too large");
  });
  test("reads the token from a hash route", () => {
    expect(tokenFromHash("#/board?share=abc_-1")).toBe("abc_-1");
    expect(tokenFromHash("#/board")).toBeNull();
  });
  test("merge keeps local work and skips annotations already present", async () => {
    const shared = await decodeShare(await encodeShare(sharedFrom(plan())!));
    const local = plan();
    local.marks = [local.marks[1]];
    local.mission = { ...emptyMission(), targets: [] };
    const merged = applyShared(local, shared, "merge");
    expect(merged.marks.map((m) => m.id)).toEqual(["aa", "route"]);
    expect(merged.map.image).toBe(image);
    expect(merged.mission?.gun).toBeNull();
    const replaced = applyShared(local, shared, "replace");
    expect(replaced.name).toBe("Bridge push");
    expect(replaced.mission?.gun).toEqual({ x: 80.12, y: 80.46 });
    const other = plan();
    other.map.name = "Ozeti";
    expect(() => applyShared(other, shared, "merge")).toThrow();
  });
});

test("simplify keeps corners and drops collinear points", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 5, y: 0.2 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 10, y: 10 },
  ];
  expect(simplify(points, 1)).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]);
});
