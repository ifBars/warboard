import { useSyncExternalStore } from "react";
import { coordinateText } from "../ballistics";
import type { createCursorStore } from "../cursor";

export default function CoordinateReadout({
  store,
}: {
  store: ReturnType<typeof createCursorStore>;
}) {
  const point = useSyncExternalStore(store.subscribe, store.get);
  return (
    <span>
      {point ? coordinateText(point) : "Scroll to zoom · Right-drag to pan"}
    </span>
  );
}
