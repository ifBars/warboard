import { describe, test, expect } from "bun:test";
import { obstacleHeight, onRoad, type ObstacleGrid } from "./obstacles";
const grid = (): ObstacleGrid => ({
  size: 4,
  span: 4,
  scale: 2,
  offset: -100,
  surface: new Uint16Array(16).fill(50),
  canopy: new Float32Array(16).fill(NaN),
  roads: new Uint8Array(16),
  roadSpan: 4,
});
describe("Obstacle sampling", () => {
  test("north-up samples combine calibrated structures and absolute canopy", () => {
    const g = grid();
    g.surface[1] = 60;
    g.canopy[1] = 35;
    expect(obstacleHeight(g, { x: 1.1, y: 3.9 })).toBe(35);
    g.canopy[1] = 10;
    expect(obstacleHeight(g, { x: 1.1, y: 3.9 })).toBe(20);
    expect(obstacleHeight(g, { x: 1.1, y: 0.1 })).toBe(0);
  });
  test("buffer catches adjacent obstacles and south edge is included", () => {
    const g = grid();
    g.canopy[14] = 45;
    expect(obstacleHeight(g, { x: 1.1, y: 0 })).toBe(0);
    expect(obstacleHeight(g, { x: 1.1, y: 0 }, 100)).toBe(45);
    expect(obstacleHeight(g, { x: -1, y: 2 })).toBeNull();
    expect(obstacleHeight(undefined, { x: 1, y: 1 })).toBeNull();
  });
  test("road preference never removes an obstacle", () => {
    const g = grid();
    g.roads![5] = 1;
    g.canopy[5] = 25;
    expect(onRoad(g, { x: 1.5, y: 2.5 })).toBe(true);
    expect(obstacleHeight(g, { x: 1.5, y: 2.5 })).toBe(25);
    expect(onRoad(g, { x: 8, y: 2 })).toBe(false);
  });
});
