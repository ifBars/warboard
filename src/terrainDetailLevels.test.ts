import { expect, test } from "bun:test";
import { terrainDetailLevel } from "./terrainDetailLevels";

test("3D color detail levels stay within each map's bundled pyramid", () => {
  expect(terrainDetailLevel("bakurani", 16384)).toBe(5);
  expect(terrainDetailLevel("ozeti", 32768)).toBe(6);
  expect(terrainDetailLevel("zestafona", 8192)).toBe(4);
  expect(terrainDetailLevel("zestafona", 32768)).toBe(4);
  expect(terrainDetailLevel("custom", 32768)).toBeNull();
});
