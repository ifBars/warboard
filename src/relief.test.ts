import { expect, test } from "bun:test";
import { contours, hillshade } from "./relief";

const size = 41;
const cone = Float32Array.from({ length: size * size }, (_, i) => {
  const r = Math.floor(i / size) - 20,
    c = (i % size) - 20;
  return 100 - Math.hypot(r, c) * 5;
});

test("contours ring a cone at each interval, with index lines", () => {
  const { segments } = contours(cone, size, 20, 5);
  expect(segments.length % 5).toBe(0);
  const levels = new Set<number>();
  for (let i = 0; i < segments.length; i += 5) {
    const x = segments[i] - 20,
      y = segments[i + 1] - 20;
    levels.add(Math.round((100 - Math.hypot(x, y) * 5) / 20) * 20);
    expect(segments[i + 4] === 0 || segments[i + 4] === 1).toBe(true);
  }
  // 100 m peak down to about -41 m in the corners.
  expect([...levels].sort((a, b) => a - b)).toEqual([-40, -20, 0, 20, 40, 60, 80]);
  expect([...segments].some((v, i) => i % 5 === 4 && v === 1)).toBe(true);
});

test("hillshade is uniform on flat ground and darker on shadowed slopes", () => {
  const flat = hillshade(new Float32Array(16).fill(5), 4, 8);
  expect(new Set([...flat].filter((_, i) => i % 4 === 0)).size).toBe(1);
  const shade = hillshade(cone, size, 8);
  const at = (r: number, c: number) => shade[(r * size + c) * 4];
  // Sun from the north-west lights that flank and shades the south-east.
  expect(at(10, 10)).toBeGreaterThan(at(30, 30));
});
