import { useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { basePiece, type BasePlan } from "../base";
export default function BasePreview({ base }: { base: BasePlan }) {
  const [error, setError] = useState("");
  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        setError("3D is unavailable. Use the footprint view.");
        return;
      }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      node.append(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#151c1e");
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
      camera.position.set(70, 65, 70);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 3, 0);
      controls.update();
      scene.add(new THREE.HemisphereLight(0xc4eef2, 0x28302b, 2));
      const sun = new THREE.DirectionalLight(0xffffff, 2);
      sun.position.set(-30, 60, 20);
      scene.add(sun);
      const grid = new THREE.GridHelper(120, 24, 0x546b70, 0x29393d);
      scene.add(grid);
      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];
      for (const p of base.pieces) {
        const b = basePiece(p.kind)!;
        const geometry = new THREE.BoxGeometry(
          b.width,
          Math.max(0.08, b.height),
          b.depth,
        );
        const material = new THREE.MeshLambertMaterial({
          color: p.kind === "fob" ? 0xe8bb48 : 0x73b7c7,
          transparent: true,
          opacity: 0.8,
        });
        geometries.push(geometry);
        materials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(p.x, p.elevation + b.height / 2, -p.y);
        mesh.rotation.y = (p.rotation * Math.PI) / 180;
        scene.add(mesh);
      }
      const render = () => renderer.render(scene, camera);
      const observer = new ResizeObserver(() => {
        const w = node.clientWidth,
          h = node.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        render();
      });
      observer.observe(node);
      controls.addEventListener("change", render);
      render();
      return () => {
        observer.disconnect();
        controls.dispose();
        renderer.dispose();
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        grid.geometry.dispose();
        if (Array.isArray(grid.material))
          grid.material.forEach((m) => m.dispose());
        else grid.material.dispose();
        renderer.domElement.remove();
      };
    },
    [base],
  );
  return (
    <div
      className="base-preview"
      ref={mount}
      role="img"
      aria-label="Three-dimensional base envelopes. Drag to orbit; right-drag to pan."
    >
      {error && <p>{error}</p>}
    </div>
  );
}
