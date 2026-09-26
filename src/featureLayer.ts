import * as T from "three";
import type { Point } from "./model";
import type { TerrainFeatures } from "./terrainFeatures";

/** Bilinear ground height from derived features, or null outside coverage. */
export function featureGround(f: TerrainFeatures, p: Point): number | null {
  const n = f.groundSize,
    x = (p.x / f.span) * n - 0.5,
    y = (1 - p.y / f.span) * n - 0.5;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < -0.5 || y < -0.5)
    return null;
  if (x > n - 0.5 || y > n - 0.5) return null;
  const x0 = Math.max(0, Math.min(n - 2, Math.floor(x))),
    y0 = Math.max(0, Math.min(n - 2, Math.floor(y)));
  const tx = Math.max(0, Math.min(1, x - x0)),
    ty = Math.max(0, Math.min(1, y - y0));
  const g = f.ground,
    a = g[y0 * n + x0],
    b = g[y0 * n + x0 + 1],
    c = g[(y0 + 1) * n + x0],
    d = g[(y0 + 1) * n + x0 + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Terrain geometry sampled from the derived bare ground, with map UVs. */
export function featureTerrain(
  f: TerrainFeatures,
  center: Point,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const n = f.groundSize,
    cell = f.span / n,
    extent = (f.span - cell) * 100;
  const geometry = new T.PlaneGeometry(extent, extent, n - 1, n - 1);
  geometry.rotateX(-Math.PI / 2);
  // Plane vertices are centred on the scene origin; shift to the grid centre.
  geometry.translate(
    (f.span / 2 - center.x) * 100,
    0,
    -(f.span / 2 - center.y) * 100,
  );
  const positions = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, f.ground[i]);
    const x = ((i % n) + 0.5) * cell,
      y = f.span - (Math.floor(i / n) + 0.5) * cell;
    uv.setXY(
      i,
      (x - bounds.minX) / (bounds.maxX - bounds.minX),
      (y - bounds.minY) / (bounds.maxY - bounds.minY),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Vertex colours give roofs and crowns definition even with lighting off.
function shade(geometry: T.BufferGeometry, color: (y: number, normalY: number) => T.Color) {
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++)
    color(position.getY(i), normal.getY(i)).toArray(colors, i * 3);
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  return geometry;
}
function pineGeometry() {
  // Two stacked crowns and a short trunk, unit height, base at 0.
  const parts = [
    new T.CylinderGeometry(0.06, 0.08, 0.2, 5).translate(0, 0.1, 0),
    new T.ConeGeometry(0.5, 0.55, 7).translate(0, 0.43, 0),
    new T.ConeGeometry(0.36, 0.45, 7).translate(0, 0.775, 0),
  ].map((g) => g.toNonIndexed());
  const count = parts.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const position = new Float32Array(count * 3);
  let offset = 0;
  for (const g of parts) {
    position.set(g.getAttribute("position").array as Float32Array, offset);
    offset += g.getAttribute("position").count * 3;
    g.dispose();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.computeVertexNormals();
  const trunk = new T.Color(0x5b4632),
    low = new T.Color(0x2f5a2b),
    high = new T.Color(0x6f9a4f);
  return shade(geometry, (y) =>
    y < 0.2 ? trunk.clone() : low.clone().lerp(high, Math.min(1, (y - 0.2) / 0.8)),
  );
}
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const TREE_LIMIT = 70000;

export function createFeatureLayer(
  world: T.Group,
  vector: (p: Point, height: number) => T.Vector3,
  f: TerrainFeatures,
) {
  const cell = f.cellMeters;
  const roof = new T.Color(0xd4cdbf),
    wall = new T.Color(0x8e877b);
  const boxGeometry = shade(
    new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    (_, normalY) => (normalY > 0.5 ? roof : wall).clone(),
  );
  const buildingMaterial = new T.MeshLambertMaterial({ vertexColors: true });
  const count = f.buildings.length / 5;
  const buildings = new T.InstancedMesh(boxGeometry, buildingMaterial, count);
  const matrix = new T.Matrix4(),
    position = new T.Vector3(),
    scale = new T.Vector3(),
    rotation = new T.Quaternion(),
    up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const k = i * 5,
      // Sink each box a little so it meets sloped ground without a gap.
      base = f.buildings[k + 2] - 2;
    position.copy(vector({ x: f.buildings[k], y: f.buildings[k + 1] }, base));
    scale.set(f.buildings[k + 4], f.buildings[k + 3] + 2, cell);
    buildings.setMatrixAt(i, matrix.compose(position, rotation, scale));
  }
  buildings.instanceMatrix.needsUpdate = true;
  buildings.computeBoundingSphere();
  buildings.userData.featureLayer = "structures";

  // Canopy envelopes as low-poly crowns, drawn only near the view centre.
  const crown = pineGeometry();
  const treeMaterial = new T.MeshLambertMaterial({ vertexColors: true });
  const trees = new T.InstancedMesh(crown, treeMaterial, TREE_LIMIT);
  trees.count = 0;
  trees.frustumCulled = false;
  trees.userData.featureLayer = "trees";
  const color = new T.Color();
  world.add(buildings, trees);
  let windowKey = "";

  return {
    buildings,
    trees,
    /** Rebuild trees around a game-coordinate centre within radius metres. */
    updateTrees(center: Point, radius: number) {
      const r = Math.max(200, radius) / 100;
      const key = `${center.x.toFixed(1)},${center.y.toFixed(1)},${r.toFixed(1)}`;
      if (key === windowKey) return;
      windowKey = key;
      const total = f.trees.length / 4;
      let inside = 0;
      for (let i = 0; i < total; i++) {
        const x = f.trees[i * 4],
          y = f.trees[i * 4 + 1];
        if (Math.abs(x - center.x) <= r && Math.abs(y - center.y) <= r)
          inside++;
      }
      // Thin evenly when the window holds more crowns than the budget.
      const stride = Math.max(1, Math.ceil(inside / TREE_LIMIT));
      let seen = 0,
        n = 0;
      for (let i = 0; i < total && n < TREE_LIMIT; i++) {
        const k = i * 4,
          x = f.trees[k],
          y = f.trees[k + 1];
        if (Math.abs(x - center.x) > r || Math.abs(y - center.y) > r) continue;
        if (seen++ % stride) continue;
        const jitter = hash(i),
          width = cell * (0.9 + jitter * 0.5) * Math.sqrt(stride);
        // Up to a third of a cell of jitter hides the raster rows.
        const dx = (hash(i + 0.37) - 0.5) * 0.33 * cell,
          dz = (hash(i + 0.71) - 0.5) * 0.33 * cell;
        position.copy(vector({ x, y }, f.trees[k + 2] - 1));
        position.x += dx;
        position.z += dz;
        scale.set(width, f.trees[k + 3] + 1, width);
        rotation.setFromAxisAngle(up, jitter * Math.PI * 2);
        trees.setMatrixAt(n, matrix.compose(position, rotation, scale));
        trees.setColorAt(n, color.setHSL(0, 0, 0.85 + jitter * 0.3));
        n++;
      }
      rotation.identity();
      trees.count = n;
      trees.instanceMatrix.needsUpdate = true;
      if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    },
    setVisible(structures: boolean, canopy: boolean) {
      buildings.visible = structures;
      trees.visible = canopy;
    },
    dispose() {
      world.remove(buildings, trees);
      buildings.dispose();
      trees.dispose();
      boxGeometry.dispose();
      crown.dispose();
      buildingMaterial.dispose();
      treeMaterial.dispose();
    },
  };
}
