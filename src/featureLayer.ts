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
function shade(
  geometry: T.BufferGeometry,
  color: (y: number, normalY: number) => T.Color,
) {
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++)
    color(position.getY(i), normal.getY(i)).toArray(colors, i * 3);
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  return geometry;
}
const hash = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};
// Smooth value noise over game units, used to group trees into stands and gaps.
function noise(x: number, y: number) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    tx = x - x0,
    ty = y - y0;
  const corner = (cx: number, cy: number) => hash(cx * 157.1 + cy * 311.7);
  const sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty);
  const top = corner(x0, y0) + (corner(x0 + 1, y0) - corner(x0, y0)) * sx,
    bottom =
      corner(x0, y0 + 1) + (corner(x0 + 1, y0 + 1) - corner(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}
function merge(parts: T.BufferGeometry[], wobble: number, seed: number) {
  const flat = parts.map((g) => g.toNonIndexed());
  const count = flat.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const position = new Float32Array(count * 3);
  let offset = 0;
  for (const g of flat) {
    position.set(g.getAttribute("position").array as Float32Array, offset);
    offset += g.getAttribute("position").count * 3;
    g.dispose();
  }
  for (const g of parts) g.dispose();
  // Displace crown vertices consistently (shared positions move together)
  // so silhouettes are irregular rather than perfect cones.
  for (let i = 0; i < position.length; i += 3) {
    const y = position[i + 1];
    if (y < 0.18) continue;
    const key =
      Math.round(position[i] * 50) * 7.1 +
      Math.round(y * 50) * 13.3 +
      Math.round(position[i + 2] * 50) * 3.7 +
      seed;
    position[i] *= 1 + (hash(key) - 0.5) * wobble;
    position[i + 2] *= 1 + (hash(key + 1) - 0.5) * wobble;
    position[i + 1] += (hash(key + 2) - 0.5) * wobble * 0.15;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.computeVertexNormals();
  return geometry;
}
const trunkColor = new T.Color(0x5b4632);
function pineGeometry() {
  // Trunk and three uneven tiers, unit height, base at 0.
  const geometry = merge(
    [
      new T.CylinderGeometry(0.035, 0.05, 0.3, 5).translate(0, 0.15, 0),
      new T.ConeGeometry(0.5, 0.42, 8).translate(0.02, 0.36, 0),
      new T.ConeGeometry(0.38, 0.36, 8).translate(-0.02, 0.6, 0.02),
      new T.ConeGeometry(0.24, 0.32, 7).translate(0, 0.84, -0.01),
    ],
    0.35,
    1,
  );
  const low = new T.Color(0x23442a),
    high = new T.Color(0x4f7d45);
  return shade(geometry, (y) =>
    y < 0.16
      ? trunkColor.clone()
      : low.clone().lerp(high, Math.min(1, (y - 0.16) / 0.84)),
  );
}
function broadleafGeometry() {
  // Trunk and a lumpy crown of three overlapping blobs.
  const geometry = merge(
    [
      new T.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0),
      new T.IcosahedronGeometry(0.34, 0).scale(1, 0.8, 1).translate(0, 0.62, 0),
      new T.IcosahedronGeometry(0.26, 0).translate(0.2, 0.56, 0.1),
      new T.IcosahedronGeometry(0.24, 0).translate(-0.16, 0.72, -0.12),
    ],
    0.3,
    2,
  );
  const low = new T.Color(0x3b5e2c),
    high = new T.Color(0x7c9f4e);
  return shade(geometry, (y) =>
    y < 0.3
      ? trunkColor.clone()
      : low.clone().lerp(high, Math.min(1, (y - 0.3) / 0.7)),
  );
}
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

  // Canopy envelopes as a thinned mix of pines and broadleaf trees, drawn
  // only near the view centre. The envelope grid marks where canopy is, not
  // individual trunks, so a fraction of cells get a tree.
  const pineShape = pineGeometry(),
    leafShape = broadleafGeometry();
  const treeMaterial = new T.MeshLambertMaterial({ vertexColors: true });
  const pines = new T.InstancedMesh(pineShape, treeMaterial, TREE_LIMIT),
    leaves = new T.InstancedMesh(leafShape, treeMaterial, TREE_LIMIT);
  const trees = new T.Group();
  for (const mesh of [pines, leaves]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    trees.add(mesh);
  }
  trees.userData.featureLayer = "trees";
  const color = new T.Color(),
    tilt = new T.Quaternion(),
    axis = new T.Vector3();
  world.add(buildings, trees);
  let windowKey = "";
  // Stand density: roughly one tree per 3–10 cells, clumped by noise.
  const keep = (i: number, x: number, y: number) =>
    hash(i * 1.37) <
    0.09 + 0.34 * Math.max(0, noise(x * 1.6, y * 1.6) * 1.4 - 0.25);

  return {
    buildings,
    trees,
    /** Rebuild trees around a game-coordinate centre within radius metres. */
    updateTrees(center: Point, radius: number) {
      const r = Math.max(200, radius) / 100;
      const key = `${center.x.toFixed(1)},${center.y.toFixed(1)},${r.toFixed(1)}`;
      if (key === windowKey) return;
      windowKey = key;
      const total = f.trees.length / 4,
        chosen: number[] = [];
      for (let i = 0; i < total; i++) {
        const x = f.trees[i * 4],
          y = f.trees[i * 4 + 1];
        if (Math.abs(x - center.x) > r || Math.abs(y - center.y) > r) continue;
        if (keep(i, x, y)) chosen.push(i);
      }
      // Thin evenly when the window holds more trees than the budget.
      const stride = Math.max(1, Math.ceil(chosen.length / (TREE_LIMIT * 1.6)));
      let pine = 0,
        leaf = 0;
      for (let c = 0; c < chosen.length; c += stride) {
        const i = chosen[c],
          k = i * 4,
          envelope = f.trees[k + 3];
        const h1 = hash(i + 0.37),
          h2 = hash(i + 0.71),
          h3 = hash(i + 0.19),
          h4 = hash(i + 0.53);
        const broadleaf = envelope < 14 || h4 < 0.25;
        const mesh = broadleaf ? leaves : pines;
        const n = broadleaf ? leaf : pine;
        if (n >= TREE_LIMIT) continue;
        // Envelopes are upper bounds; real crowns sit below them.
        const height = Math.max(3, (envelope + 1) * (0.55 + 0.4 * h1));
        const width =
          height *
          (broadleaf ? 0.65 + 0.3 * h2 : 0.34 + 0.16 * h2) *
          Math.min(1.6, Math.sqrt(stride));
        position.copy(
          vector({ x: f.trees[k], y: f.trees[k + 1] }, f.trees[k + 2] - 0.5),
        );
        position.x += (h2 - 0.5) * cell;
        position.z += (h3 - 0.5) * cell;
        scale.set(width, height, width * (0.85 + 0.3 * h3));
        // Random heading and a lean of up to ~6 degrees.
        rotation.setFromAxisAngle(up, h1 * Math.PI * 2);
        axis.set(Math.cos(h3 * 6.283), 0, Math.sin(h3 * 6.283));
        tilt.setFromAxisAngle(axis, (h4 - 0.5) * 0.2);
        rotation.premultiply(tilt);
        mesh.setMatrixAt(n, matrix.compose(position, rotation, scale));
        const shadeValue = 0.8 + 0.35 * h2;
        mesh.setColorAt(
          n,
          color.setRGB(
            shadeValue * (0.9 + 0.2 * h3),
            shadeValue,
            shadeValue * (0.85 + 0.2 * h1),
          ),
        );
        if (broadleaf) leaf++;
        else pine++;
      }
      rotation.identity();
      pines.count = pine;
      leaves.count = leaf;
      for (const m of [pines, leaves]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
    hideTrees() {
      pines.count = 0;
      leaves.count = 0;
      windowKey = "";
    },
    setVisible(structures: boolean, canopy: boolean) {
      buildings.visible = structures;
      trees.visible = canopy;
    },
    dispose() {
      world.remove(buildings, trees);
      buildings.dispose();
      pines.dispose();
      leaves.dispose();
      boxGeometry.dispose();
      pineShape.dispose();
      leafShape.dispose();
      buildingMaterial.dispose();
      treeMaterial.dispose();
    },
  };
}
