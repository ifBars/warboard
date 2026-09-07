import { factionIcon, factionIcons } from "./factionIcons";
import { createClickGesture } from "./clickGesture";
import { createTerrainDetail } from "./terrainDetail";
import { towerIconPath, towerIconUrl } from "./towerIcon";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  gridHeight,
  coverHeight,
  routeLocations,
  routeAltitudes,
  type Flight,
  type LandingCandidate,
  type RouteSample,
  type TerrainGrid,
} from "./flight";
import type { Mark, Point } from "./model";
import { point as isPoint } from "./model";
import type { mapData } from "./cartography";

export type SceneState = {
  context?: "board";
  boardMarks?: Mark[];
  image: string;
  terrainLighting: boolean;
  treeOutlines?: boolean;
  coverVisual: { canvas: HTMLCanvasElement; url: string } | null;
  treeDraft: Point[];
  towers: boolean;
  spawns: boolean;
  flight: Flight;
  samples: RouteSample[];
  candidates: LandingCandidate[];
  selected: number;
  focus: Point | null;
  mode: "2d" | "3d";
  exaggeration: number;
  onAdd: (point: Point) => void;
  onSelect: (index: number) => void;
};
export function createFlightScene(
  host: HTMLDivElement,
  grid: TerrainGrid,
  image: string,
  reference: NonNullable<ReturnType<typeof mapData>>,
) {
  const bounds = reference.tileBounds;
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor("#151b1e");
  renderer.domElement.setAttribute(
    "aria-label",
    "Flight terrain map. Double-click terrain to add a waypoint; drag to orbit, right-drag to pan, scroll to zoom.",
  );
  renderer.domElement.tabIndex = 0;
  host.append(renderer.domElement);
  const scene = new T.Scene(),
    world = new T.Group();
  scene.add(world);
  const camera = new T.OrthographicCamera(
    -10000,
    10000,
    10000,
    -10000,
    1,
    150000,
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minZoom = 0.4;
  controls.maxZoom = 100;
  controls.maxPolarAngle = Math.PI * 0.48;
  const cx = (grid.minX + grid.maxX) / 2,
    cy = (grid.minY + grid.maxY) / 2;
  const width = (grid.maxX - grid.minX) * 100,
    depth = (grid.maxY - grid.minY) * 100;
  const span = Math.max(width, depth),
    centerHeight = gridHeight(grid, { x: cx, y: cy }) ?? 0;
  const vector = (p: Point, height: number) =>
    new T.Vector3((p.x - cx) * 100, height, -(p.y - cy) * 100);
  const geometry = new T.PlaneGeometry(
    width,
    depth,
    grid.size - 1,
    grid.size - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, grid.heights[i]);
    const x =
        grid.minX +
        ((i % grid.size) / (grid.size - 1)) * (grid.maxX - grid.minX),
      y =
        grid.maxY -
        (Math.floor(i / grid.size) / (grid.size - 1)) * (grid.maxY - grid.minY);
    uv.setXY(
      i,
      (x - bounds.minX) / (bounds.maxX - bounds.minX),
      (y - bounds.minY) / (bounds.maxY - bounds.minY),
    );
  }
  geometry.computeVertexNormals();
  let disposed = false;
  let detail: ReturnType<typeof createTerrainDetail> | null = null;
  const render = () => {
    if (!disposed) {
      const unit =
        (camera.top - camera.bottom) /
        camera.zoom /
        Math.max(1, host.clientHeight);
      world.traverse((o) => {
        if (o instanceof T.Sprite) {
          if (o.userData.towerDetail) o.visible = camera.zoom >= 3;
          if (o.userData.towerCluster) o.visible = camera.zoom < 3;
          o.scale.set(
            (o.userData.pixelWidth ?? 36) * unit,
            ((o.userData.pixelHeight ?? 36) * unit) / world.scale.y,
            1,
          );
        }
      });
      renderer.render(scene, camera);
      detail?.update(
        currentImage,
        ((bounds.maxX - bounds.minX) *
          100 *
          host.clientWidth *
          renderer.getPixelRatio() *
          camera.zoom) /
          (camera.right - camera.left),
        (controls.target.x / 100 + cx - bounds.minX) /
          (bounds.maxX - bounds.minX),
        (cy - controls.target.z / 100 - bounds.minY) /
          (bounds.maxY - bounds.minY),
      );
    }
  };
  const loader = new T.TextureLoader();
  const texture = loader.load(image, render);
  const textures = new Map<string, T.Texture>([[image, texture]]);
  let currentImage = image;
  let coverMesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial> | null = null;
  let lastCover: SceneState["coverVisual"] = null,
    lastCanopy = 0;
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshLambertMaterial({
    map: texture,
    side: T.DoubleSide,
  });
  const terrain = new T.Mesh(geometry, material);
  detail = createTerrainDetail(material, renderer, (resolution) => {
    renderer.domElement.dataset.terrainResolution = String(resolution);
    render();
  });
  world.add(terrain);
  const sky = new T.HemisphereLight(0xffffff, 0xa9b4b8, 2);
  const flatLight = new T.AmbientLight(0xffffff, 1);
  scene.add(sky, flatLight);
  const sun = new T.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-8000, 6500, 5000);
  scene.add(sun);
  let overlay = new T.Group();
  world.add(overlay);
  let state: SceneState | null = null,
    mode = "",
    factor = 1;
  const towerImage = new Image();
  towerImage.onload = () => {
    if (!disposed && state) update(state);
  };
  towerImage.src = towerIconUrl;
  const factionImages = new Map<string, HTMLImageElement>();
  for (const url of Object.values(factionIcons)) {
    const image = new Image();
    image.onload = () => {
      if (!disposed && state) update(state);
    };
    image.src = url;
    factionImages.set(url, image);
  }
  function releaseOverlay() {
    overlay.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (m instanceof T.SpriteMaterial) m.map?.dispose();
          m.dispose();
        }
      }
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    world.remove(overlay);
    overlay = new T.Group();
    world.add(overlay);
  }
  function line(points: T.Vector3[], color: number, dashed = false) {
    if (points.length < 2) return;
    const m = dashed
      ? new T.LineDashedMaterial({
          color,
          dashSize: 70,
          gapSize: 50,
          depthTest: false,
        })
      : new T.LineBasicMaterial({ color, depthTest: false });
    const l = new T.Line(new T.BufferGeometry().setFromPoints(points), m);
    l.renderOrder = 2;
    l.computeLineDistances();
    overlay.add(l);
  }
  function label(text: string, p: T.Vector3, color: string, index?: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(48, 48, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151b1e";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 48, 49);
    const map = new T.CanvasTexture(canvas),
      sprite = new T.Sprite(
        new T.SpriteMaterial({ map, depthTest: false, sizeAttenuation: false }),
      );
    sprite.position.copy(p);
    sprite.scale.set(420, 420, 1);
    sprite.renderOrder = 3;
    sprite.userData.waypoint = index;
    overlay.add(sprite);
  }
  function landmarkLabel(
    text: string,
    p: Point,
    color: string,
    tower: "detail" | "cluster" | null = null,
  ) {
    const height = gridHeight(grid, p);
    if (height === null) return;
    const canvas = document.createElement("canvas");
    const faction = factionImages.get(factionIcon(text) ?? "");
    const icon = tower || faction;
    canvas.width = icon ? 144 : 384;
    canvas.height = icon ? 144 : 72;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (tower) {
      ctx.scale(3, 3);
      ctx.translate(24, 24);
      ctx.fillStyle = "#151b1eee";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      const diamond = new Path2D("M0 -20 20 0 0 20 -20 0Z");
      ctx.fill(diamond);
      ctx.stroke(diamond);
      ctx.save();
      ctx.translate(-12, -12);
      ctx.fillStyle = "#f4f2e9";
      ctx.fill(new Path2D(towerIconPath));
      ctx.restore();
      if (towerImage.complete && towerImage.naturalWidth) {
        ctx.clearRect(-24, -24, 48, 48);
        ctx.drawImage(towerImage, -24, -24, 48, 48);
      }
      ctx.beginPath();
      ctx.arc(14, 14, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#151b1e";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        tower === "cluster"
          ? `${text.split(" ")[0]}+`
          : text.replace(/^Tower\s*/i, ""),
        14,
        14,
      );
    } else if (faction) {
      if (faction.complete && faction.naturalWidth) {
        ctx.drawImage(faction, 6, 6, 132, 132);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 144, 144);
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.fillStyle = "#151b1edd";
      ctx.fillRect(0, 0, 384, 72);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 380, 68);
      ctx.fillStyle = color;
      ctx.font = "500 32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 192, 37, 370);
    }
    const texture = new T.CanvasTexture(canvas),
      sprite = new T.Sprite(
        new T.SpriteMaterial({ map: texture, depthTest: false }),
      );
    texture.colorSpace = T.SRGBColorSpace;
    sprite.position.copy(vector(p, height + 12));
    sprite.userData.pixelWidth = icon ? 44 : 70;
    sprite.userData.pixelHeight = icon ? 44 : 24;
    sprite.userData.label = text;
    sprite.userData.towerDetail = tower === "detail";
    sprite.userData.towerCluster = tower === "cluster";
    sprite.userData.landmark = p;
    sprite.center.set(0.5, icon ? 0.2 : -0.75);
    sprite.renderOrder = 1;
    overlay.add(sprite);
  }
  function reset() {
    controls.target.set(0, centerHeight * factor, 0);
    camera.zoom = 1;
    camera.position.set(
      0,
      centerHeight * factor + span,
      mode === "2d" ? 0.01 : span * 0.85,
    );
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }
  function update(next: SceneState) {
    state = next;
    sky.intensity = next.terrainLighting ? 1.1 : 0;
    sun.intensity = next.terrainLighting ? 2.1 : 0;
    flatLight.intensity = next.terrainLighting ? 0 : Math.PI;
    if (next.image !== currentImage) {
      currentImage = next.image;
      let nextTexture = textures.get(next.image);
      if (!nextTexture) {
        const wanted = next.image;
        nextTexture = loader.load(
          wanted,
          () => {
            if (!disposed) render();
          },
          undefined,
          () => {
            textures.delete(wanted);
            if (!disposed && currentImage === wanted) {
              material.map = texture;
              material.color.setScalar(1);
              material.needsUpdate = true;
              render();
            }
          },
        );
        nextTexture.colorSpace = T.SRGBColorSpace;
        textures.set(wanted, nextTexture);
      }
      material.map = nextTexture;
      material.color.setScalar(1);
      material.needsUpdate = true;
    }
    if (
      next.coverVisual !== lastCover ||
      (next.flight.autoTrees?.height ?? 0) !== lastCanopy
    ) {
      if (coverMesh) {
        world.remove(coverMesh);
        coverMesh.geometry.dispose();
        coverMesh.material.map?.dispose();
        coverMesh.material.dispose();
        coverMesh = null;
      }
      lastCover = next.coverVisual;
      lastCanopy = next.flight.autoTrees?.height ?? 0;
      if (lastCover) {
        const meshGeometry = geometry.clone(),
          vertices = meshGeometry.getAttribute("position");
        for (let i = 0; i < vertices.count; i++)
          vertices.setY(i, vertices.getY(i) + lastCanopy + 3);
        const maskTexture = new T.CanvasTexture(lastCover.canvas);
        maskTexture.colorSpace = T.SRGBColorSpace;
        coverMesh = new T.Mesh(
          meshGeometry,
          new T.MeshBasicMaterial({
            map: maskTexture,
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
        );
        world.add(coverMesh);
      }
    }
    renderer.domElement.setAttribute(
      "aria-label",
      next.context === "board"
        ? "Board terrain map. Double-click to mark a FOB candidate; drag to orbit, right-drag to pan, scroll to zoom."
        : "Flight terrain map. Double-click terrain to add a waypoint; drag to orbit, right-drag to pan, scroll to zoom.",
    );
    releaseOverlay();
    const gamePoint = (p: Point): Point => ({
      x: bounds.minX + (p.x / 4096) * (bounds.maxX - bounds.minX),
      y: bounds.maxY - (p.y / 4096) * (bounds.maxY - bounds.minY),
    });
    for (const mark of next.boardMarks ?? []) {
      const first = mark.points[0],
        last = mark.points.at(-1);
      if (!first || !last) continue;
      if (mark.type === "note") {
        landmarkLabel(mark.text || "Note", gamePoint(first), mark.color);
        continue;
      }
      const radius = Math.hypot(last.x - first.x, last.y - first.y);
      const points =
        mark.type === "circle"
          ? Array.from({ length: 97 }, (_, i) => ({
              x: first.x + Math.cos((i / 96) * Math.PI * 2) * radius,
              y: first.y + Math.sin((i / 96) * Math.PI * 2) * radius,
            }))
          : mark.points;
      const drape = (pixels: Point[]) => {
        const vertices: T.Vector3[] = [];
        for (let i = 1; i < pixels.length; i++) {
          const a = gamePoint(pixels[i - 1]),
            b = gamePoint(pixels[i]);
          const steps = Math.min(
            2048,
            Math.max(
              1,
              Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) * 100) / 20),
            ),
          );
          for (let j = 0; j <= steps; j++) {
            const p = {
                x: a.x + ((b.x - a.x) * j) / steps,
                y: a.y + ((b.y - a.y) * j) / steps,
              },
              h = gridHeight(grid, p);
            if (h !== null) vertices.push(vector(p, h + 8));
          }
        }
        line(vertices, new T.Color(mark.color).getHex());
      };
      drape(points);
      if (mark.type === "arrow" && points.length > 1) {
        const prev = points[points.length - 2],
          angle = Math.atan2(last.y - prev.y, last.x - prev.x),
          size = 35;
        drape([
          {
            x: last.x - Math.cos(angle - 0.5) * size,
            y: last.y - Math.sin(angle - 0.5) * size,
          },
          last,
          {
            x: last.x - Math.cos(angle + 0.5) * size,
            y: last.y - Math.sin(angle + 0.5) * size,
          },
        ]);
      }
    }
    factor = next.exaggeration;
    world.scale.y = factor;
    if (mode !== next.mode) {
      mode = next.mode;
      controls.enableRotate = mode === "3d";
      controls.mouseButtons.LEFT = mode === "2d" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
      reset();
    }
    if (next.spawns)
      for (const poly of reference.polygons) {
        const vertices = poly.points.map((p) => ({
            x: p.x / 100,
            y: p.y / 100,
          })),
          edge: T.Vector3[] = [];
        for (let i = 0; i < vertices.length; i++) {
          const a = vertices[i],
            b = vertices[(i + 1) % vertices.length],
            steps = Math.max(
              1,
              Math.ceil((Math.hypot(a.x - b.x, a.y - b.y) * 100) / 20),
            );
          for (let j = 0; j <= steps; j++) {
            const p = {
                x: a.x + ((b.x - a.x) * j) / steps,
                y: a.y + ((b.y - a.y) * j) / steps,
              },
              h = gridHeight(grid, p);
            if (h !== null) edge.push(vector(p, h + 6));
          }
        }
        line(edge, new T.Color(poly.color).getHex(), true);
        const outline = vertices.map((p) => new T.Vector2(p.x, p.y));
        const faces = T.ShapeUtils.triangulateShape(outline, []).flat();
        const fillGeometry = new T.BufferGeometry().setFromPoints(
          vertices.map((p) => vector(p, (gridHeight(grid, p) ?? 0) + 4)),
        );
        fillGeometry.setIndex(faces);
        const fill = new T.Mesh(
          fillGeometry,
          new T.MeshBasicMaterial({
            color: poly.color,
            transparent: true,
            opacity: 0.18,
            side: T.DoubleSide,
            depthTest: false,
            depthWrite: false,
          }),
        );
        fill.renderOrder = 1;
        overlay.add(fill);
        landmarkLabel(
          poly.label,
          {
            x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length,
            y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length,
          },
          poly.color,
        );
      }
    if (next.towers) {
      const towers = reference.markers.filter((m) => m.icon === "tower");
      if (towers.length)
        landmarkLabel(
          `${towers.length} towers`,
          {
            x: towers.reduce((sum, p) => sum + p.x, 0) / towers.length / 100,
            y: towers.reduce((sum, p) => sum + p.y, 0) / towers.length / 100,
          },
          "#a6dce5",
          "cluster",
        );
      for (const marker of towers)
        landmarkLabel(
          marker.label,
          { x: marker.x / 100, y: marker.y / 100 },
          "#a6dce5",
          "detail",
        );
    }
    if (next.flight.towerBuffer)
      for (const tower of reference.markers.filter((m) => m.icon === "tower")) {
        const radius = next.flight.towerBuffer / 100;
        const ring = Array.from({ length: 65 }, (_, i) => ({
          x: tower.x / 100 + Math.cos((i / 64) * Math.PI * 2) * radius,
          y: tower.y / 100 + Math.sin((i / 64) * Math.PI * 2) * radius,
        }));
        line(
          ring.map((p) => vector(p, (gridHeight(grid, p) ?? 0) + 8)),
          0xeb796a,
          true,
        );
      }
    for (const area of next.treeOutlines ? (next.flight.treeAreas ?? []) : []) {
      if (area.kind === "clearing") {
        line(
          routeLocations([...area.points, area.points[0]]).map((p) =>
            vector(p, (gridHeight(grid, p) ?? 0) + 8),
          ),
          0xa6dce5,
          true,
        );
        continue;
      }
      const edge = routeLocations([...area.points, area.points[0]]);
      line(
        edge.map((p) => vector(p, (gridHeight(grid, p) ?? 0) + area.height)),
        0x94cf8b,
      );
      line(
        edge.map((p) => vector(p, (gridHeight(grid, p) ?? 0) + 3)),
        0x94cf8b,
        true,
      );
      for (const p of area.points)
        line(
          [
            vector(p, (gridHeight(grid, p) ?? 0) + 3),
            vector(p, (gridHeight(grid, p) ?? 0) + area.height),
          ],
          0x94cf8b,
          true,
        );
    }
    if (next.treeDraft.length) {
      line(
        next.treeDraft.map((p) => vector(p, (gridHeight(grid, p) ?? 0) + 6)),
        0xe8bb48,
      );
      next.treeDraft.forEach((p, i) =>
        label(
          String(i + 1),
          vector(p, (gridHeight(grid, p) ?? 0) + 6),
          "#94cf8b",
        ),
      );
    }
    const path = routeAltitudes(next.flight, next.samples);
    const unsafe = (s: (typeof path)[number]) => {
      const canopy = coverHeight(s, next.flight, grid);
      return s.altitude <= s.ground + (canopy ? canopy + 10 : 0);
    };
    line(
      path.map((s) => vector(s, s.ground + 5)),
      0x88999e,
      true,
    );
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      // Grouping adjacent samples into one geometry avoids thousands of draw calls.
      {
        let end = i;
        const bad = unsafe(a) || unsafe(b);
        while (
          end < path.length - 1 &&
          (unsafe(path[end]) || unsafe(path[end + 1])) === bad
        )
          end++;
        line(
          path.slice(i - 1, end + 1).map((s) => vector(s, s.altitude)),
          bad ? 0xed796a : 0xa6dce5,
        );
        i = end;
      }
    }
    next.flight.waypoints.forEach((p, i) => {
      const sample = next.samples.find(
        (s) => (s.leg === i && s.t === 0) || (s.leg === i - 1 && s.t === 1),
      );
      const ground = sample?.ground ?? gridHeight(grid, p);
      if (ground === null) return;
      const altitude = p.altitude + (next.flight.mode === "agl" ? ground : 0);
      line([vector(p, ground + 3), vector(p, altitude)], 0x88999e, true);
      label(
        String(i + 1),
        vector(p, altitude),
        i === next.selected ? "#e8bb48" : "#a6dce5",
        i,
      );
    });
    next.candidates.forEach((p, i) => {
      const r = p.radius / 100,
        corners = [
          { x: p.x - r, y: p.y - r },
          { x: p.x + r, y: p.y - r },
          { x: p.x + r, y: p.y + r },
          { x: p.x - r, y: p.y + r },
          { x: p.x - r, y: p.y - r },
        ];
      line(
        corners.map((c) => vector(c, (gridHeight(grid, c) ?? 0) + 8)),
        0xa6cfa5,
      );
      const h = gridHeight(grid, p);
      if (h !== null)
        label(String.fromCharCode(65 + i), vector(p, h + 8), "#a6cfa5");
    });
    if (next.focus) {
      const h =
        path.find((s) => s.x === next.focus?.x && s.y === next.focus?.y)
          ?.altitude ?? gridHeight(grid, next.focus);
      if (h !== null) {
        const dot = new T.Mesh(
          new T.SphereGeometry(35, 12, 8),
          new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
        );
        dot.position.copy(vector(next.focus, h));
        overlay.add(dot);
      }
    }
    render();
  }
  const observer = new ResizeObserver(() => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    const aspect = w / h;
    camera.left = -span * 0.58 * aspect;
    camera.right = span * 0.58 * aspect;
    camera.top = span * 0.58;
    camera.bottom = -span * 0.58;
    camera.updateProjectionMatrix();
    render();
  });
  observer.observe(host);
  controls.addEventListener("change", render);
  const clickGesture = createClickGesture();
  const down = (e: PointerEvent) =>
    clickGesture.down(e.pointerId, e.clientX, e.clientY, e.button);
  const move = (e: PointerEvent) => {
    clickGesture.move(e.pointerId, e.clientX, e.clientY);
    if (e.buttons) {
      renderer.domElement.title = "";
      return;
    }
    cast(e);
    const hit = ray
      .intersectObjects(overlay.children)
      .find(
        (h) => h.object.visible && typeof h.object.userData.label === "string",
      );
    renderer.domElement.title = hit?.object.userData.label ?? "";
  };
  const up = (e: PointerEvent) =>
    clickGesture.up(e.pointerId, e.clientX, e.clientY);
  const cancel = (e: PointerEvent) => clickGesture.cancel(e.pointerId);
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", cancel);
  const ray = new T.Raycaster();
  function cast(e: MouseEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
  }
  const add = (e: MouseEvent) => {
    if (!clickGesture.allowsClick()) return;
    cast(e);
    const hit = ray.intersectObject(terrain)[0];
    if (hit)
      state?.onAdd({ x: hit.point.x / 100 + cx, y: cy - hit.point.z / 100 });
  };
  const select = (e: MouseEvent) => {
    if (!clickGesture.allowsClick()) return;
    cast(e);
    const landmarkHit = ray
      .intersectObjects(overlay.children)
      .find((h) => h.object.visible && isPoint(h.object.userData.landmark));
    if (landmarkHit && isPoint(landmarkHit.object.userData.landmark)) {
      focus(landmarkHit.object.userData.landmark);
      return;
    }
    const hit = ray
      .intersectObjects(overlay.children)
      .find(
        (h) =>
          h.object.visible && typeof h.object.userData.waypoint === "number",
      );
    if (hit) state?.onSelect(hit.object.userData.waypoint);
  };
  renderer.domElement.addEventListener("dblclick", add);
  renderer.domElement.addEventListener("click", select);
  function focus(p: Point) {
    const target = vector(p, (gridHeight(grid, p) ?? 0) * factor),
      delta = target.clone().sub(controls.target);
    camera.position.add(delta);
    controls.target.copy(target);
    camera.zoom = Math.max(camera.zoom, 8);
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }
  return {
    update,
    reset,
    focus,
    dispose() {
      disposed = true;
      towerImage.onload = null;
      for (const image of factionImages.values()) image.onload = null;
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("dblclick", add);
      renderer.domElement.removeEventListener("click", select);
      releaseOverlay();
      geometry.dispose();
      detail?.dispose();
      material.dispose();
      for (const item of textures.values()) item.dispose();
      if (coverMesh) {
        coverMesh.geometry.dispose();
        coverMesh.material.map?.dispose();
        coverMesh.material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
