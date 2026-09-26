import { useSyncExternalStore } from "react";
import type { Mission } from "./ballistics";
import type { BasePlan } from "./base";
import { validatePlan, type Mark, type Plan, type Point } from "./model";
import type { Operations } from "./operations";

// Share links carry a plan's overlays for a built-in map in the URL fragment.
// Fragments are never sent to a server. The map image is not included; the
// receiver supplies its own bundled copy, and the result passes validatePlan.
export const shareMaps = ["Bakurani", "Ozeti"] as const;
export type SharedPlan = {
  v: 1;
  map: (typeof shareMaps)[number];
  name: string;
  marks: Mark[];
  mission?: Mission;
  operations?: Operations;
  base?: BasePlan;
};
const PREFIX = "share=";
const MAX_TOKEN = 120_000;
const MAX_JSON = 2_000_000;

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const roundPoint = (p: Point, places: number) => ({
  x: round(p.x, places),
  y: round(p.y, places),
});

// Ramer-Douglas-Peucker keeps freehand routes recognisable at a fraction of
// their points. Tolerance is in map pixels (4 m on built-in maps).
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start],
      b = points[end],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    let worst = -1,
      index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const d = length
        ? Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) /
          length
        : Math.hypot(p.x - a.x, p.y - a.y);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function sharedFrom(plan: Plan): SharedPlan | null {
  const map = shareMaps.find((name) => name === plan.map.name);
  if (!map || plan.map.width !== 4096 || plan.map.height !== 4096) return null;
  const mission = plan.mission && {
    ...plan.mission,
    gun: plan.mission.gun && roundPoint(plan.mission.gun, 2),
    target: plan.mission.target && roundPoint(plan.mission.target, 2),
    targets: plan.mission.targets.map((t) => ({
      ...t,
      point: roundPoint(t.point, 2),
    })),
  };
  return {
    v: 1,
    map,
    name: plan.name,
    marks: plan.marks.map((m) => ({
      ...m,
      points:
        m.type === "pen"
          ? simplify(m.points, 1).map((p) => roundPoint(p, 0))
          : m.points.map((p) => roundPoint(p, 1)),
    })),
    ...(mission && { mission }),
    ...(plan.operations && { operations: plan.operations }),
    ...(plan.base && { base: plan.base }),
  };
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream) {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(stream)
    .getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON) {
      await reader.cancel();
      throw new Error("This share link is too large.");
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
const toBase64Url = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (token: string) => {
  const text = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
};

export async function encodeShare(shared: SharedPlan) {
  const json = new TextEncoder().encode(JSON.stringify(shared));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeShare(token: string): Promise<SharedPlan> {
  if (
    !token ||
    token.length > MAX_TOKEN ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  )
    throw new Error("This share link is damaged or too long.");
  let value: SharedPlan;
  try {
    const bytes = await pipe(
      fromBase64Url(token),
      new DecompressionStream("deflate-raw"),
    );
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch (cause) {
    throw cause instanceof Error && cause.message.includes("too large")
      ? cause
      : new Error("This share link is damaged or incomplete.");
  }
  if (
    !value ||
    typeof value !== "object" ||
    value.v !== 1 ||
    !shareMaps.includes(value.map)
  )
    throw new Error("This share link is not a supported WARBOARD plan.");
  // Validate against a stand-in image; the real bundled map replaces it.
  const checked = validatePlan({
    version: 1,
    name: value.name,
    map: {
      name: value.map,
      image: "data:image/webp;base64,AA==",
      width: 4096,
      height: 4096,
    },
    marks: value.marks,
    ...(value.mission !== undefined && { mission: value.mission }),
    ...(value.operations !== undefined && { operations: value.operations }),
    ...(value.base !== undefined && { base: value.base }),
  });
  return {
    v: 1,
    map: value.map,
    name: checked.name,
    marks: checked.marks,
    ...(checked.mission && { mission: checked.mission }),
    ...(checked.operations && { operations: checked.operations }),
    ...(checked.base && { base: checked.base }),
  };
}

export function shareLink(token: string, location: Location = window.location) {
  return `${location.origin}${location.pathname}#/board?${PREFIX}${token}`;
}
export function tokenFromHash(hash: string) {
  const query = hash.split("?")[1];
  if (!query) return null;
  const match = query.split("&").find((part) => part.startsWith(PREFIX));
  return match ? match.slice(PREFIX.length) : null;
}

/** Apply a shared overlay onto a plan for the same map. */
export function applyShared(
  plan: Plan,
  shared: SharedPlan,
  mode: "replace" | "merge",
): Plan {
  if (plan.map.name !== shared.map)
    throw new Error("The shared plan belongs to a different map.");
  if (mode === "replace")
    return validatePlan({
      version: 1,
      name: shared.name,
      map: plan.map,
      marks: shared.marks,
      ...(shared.mission && { mission: shared.mission }),
      ...(shared.operations && { operations: shared.operations }),
      ...(shared.base && { base: shared.base }),
      ...(plan.flight && { flight: plan.flight }),
    });
  const ids = new Set(plan.marks.map((m) => m.id));
  const incoming = shared.marks.filter((m) => !ids.has(m.id));
  const known = new Set(plan.mission?.targets.map((t) => t.id));
  const mission =
    plan.mission && shared.mission
      ? {
          ...plan.mission,
          targets: [
            ...plan.mission.targets,
            ...shared.mission.targets.filter((t) => !known.has(t.id)),
          ].slice(0, 100),
        }
      : (plan.mission ?? shared.mission);
  return validatePlan({
    ...plan,
    marks: [...plan.marks, ...incoming].slice(0, 2000),
    ...(mission && { mission }),
    ...(!plan.operations && shared.operations && {
      operations: shared.operations,
    }),
    ...(!plan.base && shared.base && { base: shared.base }),
  });
}

// Incoming share links, from page load or a link pasted into an open tab.
type Inbox =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; shared: SharedPlan }
  | { state: "error"; message: string };
let inbox: Inbox = { state: "idle" };
const listeners = new Set<() => void>();
function publish(next: Inbox) {
  inbox = next;
  listeners.forEach((notify) => notify());
}
function receive() {
  const token = tokenFromHash(window.location.hash);
  if (!token) return;
  // Drop the token from the address bar and history once read.
  history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#/board`,
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  publish({ state: "loading" });
  decodeShare(token).then(
    (shared) => publish({ state: "ready", shared }),
    (cause: unknown) =>
      publish({
        state: "error",
        message:
          cause instanceof Error ? cause.message : "Could not read the link.",
      }),
  );
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) {
    window.addEventListener("hashchange", receive);
    receive();
  }
  return () => {
    listeners.delete(notify);
    if (!listeners.size) window.removeEventListener("hashchange", receive);
  };
}
export function useShareInbox() {
  return useSyncExternalStore(subscribe, () => inbox);
}
export function dismissShare() {
  publish({ state: "idle" });
}
