import { loadObstacles } from "./obstacles";
import { extractFeatures } from "./terrainFeatures";
self.onmessage = async (
  event: MessageEvent<{ map: string; groundSize: number }>,
) => {
  try {
    const features = extractFeatures(await loadObstacles(event.data.map), {
      groundSize: event.data.groundSize,
    });
    self.postMessage(
      { features },
      {
        transfer: [
          features.ground.buffer,
          features.buildings.buffer,
          features.trees.buffer,
        ],
      },
    );
  } catch (cause) {
    self.postMessage({
      error:
        cause instanceof Error ? cause.message : "Terrain detail unavailable.",
    });
  }
};
