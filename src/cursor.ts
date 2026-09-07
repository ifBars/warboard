import type { Point } from "./model";

// Pointer coordinates update the footer without reconciling the entire map.
export function createCursorStore() {
  let point: Point | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => point,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: Point | null) {
      if (
        point?.x.toFixed(2) === next?.x.toFixed(2) &&
        point?.y.toFixed(2) === next?.y.toFixed(2)
      )
        return;
      point = next;
      listeners.forEach((listener) => listener());
    },
  };
}
