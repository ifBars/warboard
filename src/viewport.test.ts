import { expect, test } from "bun:test";
import { visibleMap } from "./viewport";

test("visible map includes letterboxing while marker sizes stay in screen pixels", () => {
  const camera = { x: 100, y: 200, w: 1000, h: 1000 };
  expect(visibleMap(camera, { width: 1000, height: 500 })).toEqual({
    x: -400,
    y: 200,
    w: 2000,
    h: 1000,
    unit: 2,
  });
  expect(visibleMap(camera, { width: 250, height: 500 })).toEqual({
    x: 100,
    y: -300,
    w: 1000,
    h: 2000,
    unit: 4,
  });
  const zoomed = visibleMap(
    { ...camera, w: 500, h: 500 },
    { width: 250, height: 500 },
  );
  expect(zoomed.unit).toBe(2);
  expect(26 * zoomed.unit * (250 / 500)).toBe(26);
});
