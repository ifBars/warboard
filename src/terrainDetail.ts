import { assetUrl } from "./assetUrl";
import * as T from "three";

// A bounded high-resolution texture window over the overview, using the same
// terrain UVs. Geometry, picking and height calibration stay unchanged.
export function createTerrainDetail(
  material: T.MeshLambertMaterial,
  renderer: T.WebGLRenderer,
  changed: (resolution: number) => void,
) {
  const side = Math.min(
    8,
    Math.floor(renderer.capabilities.maxTextureSize / 512),
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side * 512;
  const context = canvas.getContext("2d");
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const uniforms = {
    terrainDetailMap: { value: texture },
    terrainDetailRect: { value: new T.Vector4(0, 0, 1, 1) },
    terrainDetailEnabled: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `uniform sampler2D terrainDetailMap;
uniform vec4 terrainDetailRect;
uniform float terrainDetailEnabled;
${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      T.ShaderChunk.map_fragment.replace(
        "diffuseColor *= sampledDiffuseColor;",
        `vec2 detailUv = (vMapUv - terrainDetailRect.xy) / terrainDetailRect.zw;
if (terrainDetailEnabled > 0.5 && all(greaterThanEqual(detailUv, vec2(0.0))) && all(lessThanEqual(detailUv, vec2(1.0)))) {
  vec4 detailColor = texture2D(terrainDetailMap, detailUv);
  sampledDiffuseColor = mix(sampledDiffuseColor, vec4(detailColor.rgb, 1.0), detailColor.a);
}
diffuseColor *= sampledDiffuseColor;`,
      ),
    );
  };
  material.customProgramCacheKey = () => "warboard-terrain-detail-v1";
  const cache = new Map<string, ImageBitmap>();
  let key = "",
    source = "",
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  function stop() {
    clearTimeout(timer);
    controller?.abort();
    for (const [url, bitmap] of cache) {
      if (cache.size <= 96) break;
      bitmap.close();
      cache.delete(url);
    }
  }
  return {
    update(image: string, pixelsAcrossMap: number, u: number, v: number) {
      const match = /^\/maps\/community-color\/(bakurani|ozeti)\.webp$/.exec(
        "/" + image.slice(assetUrl("/").length),
      );
      if (image !== source) {
        source = image;
        uniforms.terrainDetailEnabled.value = 0;
      }
      if (!match || !context || pixelsAcrossMap <= 4096) {
        if (key) {
          key = "";
          stop();
          uniforms.terrainDetailEnabled.value = 0;
          changed(4096);
        }
        return;
      }
      const map = match[1];
      const level = Math.min(
        map === "ozeti" ? 6 : 5,
        Math.max(4, Math.ceil(Math.log2(pixelsAcrossMap / 512))),
      );
      const count = 2 ** level;
      const x0 = Math.max(
        0,
        Math.min(count - side, Math.floor(u * count) - Math.floor(side / 2)),
      );
      const y0 = Math.max(
        0,
        Math.min(
          count - side,
          Math.floor((1 - v) * count) - Math.floor(side / 2),
        ),
      );
      const nextKey = `${map}/${level}/${x0}/${y0}`;
      if (nextKey === key) return;
      key = nextKey;
      stop();
      const request = new AbortController();
      controller = request;
      timer = setTimeout(() => {
        void (async () => {
          const tiles: { bitmap: ImageBitmap; x: number; y: number }[] = [];
          let cursor = 0;
          await Promise.all(
            Array.from({ length: 4 }, async () => {
              while (cursor < side * side && !request.signal.aborted) {
                const index = cursor++,
                  x = index % side,
                  y = Math.floor(index / side);
                const url = assetUrl(`/maps/community-color/${map}_files/${level}/${x0 + x}_${y0 + y}.webp`);
                let bitmap = cache.get(url);
                if (!bitmap) {
                  try {
                    const response = await fetch(url, {
                      signal: request.signal,
                    });
                    if (!response.ok) continue;
                    bitmap = await createImageBitmap(await response.blob());
                    if (disposed || request.signal.aborted) {
                      bitmap.close();
                      return;
                    }
                    cache.set(url, bitmap);
                  } catch {
                    continue;
                  }
                } else {
                  cache.delete(url);
                  cache.set(url, bitmap);
                }
                tiles.push({ bitmap, x, y });
              }
            }),
          );
          if (disposed || request.signal.aborted) return;
          context.clearRect(0, 0, canvas.width, canvas.height);
          for (const tile of tiles)
            context.drawImage(tile.bitmap, tile.x * 512, tile.y * 512);
          uniforms.terrainDetailRect.value.set(
            x0 / count,
            1 - (y0 + side) / count,
            side / count,
            side / count,
          );
          uniforms.terrainDetailEnabled.value = tiles.length ? 1 : 0;
          texture.needsUpdate = true;
          for (const [url, bitmap] of cache) {
            if (cache.size <= 96) break;
            bitmap.close();
            cache.delete(url);
          }
          changed(count * 512);
        })();
      }, 120);
    },
    dispose() {
      disposed = true;
      stop();
      texture.dispose();
      for (const bitmap of cache.values()) bitmap.close();
      cache.clear();
    },
  };
}
