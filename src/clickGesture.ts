// Screen-space slop tolerates hand jitter while remembering an entire drag,
// including a drag that returns to its starting position.
export function createClickGesture() {
  const pointers = new Map<number, { x: number; y: number }>();
  let blocked = true;
  return {
    down(id: number, x: number, y: number, button: number) {
      if (pointers.size === 0) blocked = button !== 0;
      else blocked = true;
      pointers.set(id, { x, y });
    },
    move(id: number, x: number, y: number) {
      const start = pointers.get(id);
      if (start && Math.hypot(x - start.x, y - start.y) > 5) blocked = true;
    },
    up(id: number, x: number, y: number) {
      this.move(id, x, y);
      pointers.delete(id);
    },
    cancel(id: number) {
      pointers.delete(id);
      blocked = true;
    },
    allowsClick() {
      return !blocked && pointers.size === 0;
    },
  };
}
