import { useSyncExternalStore } from "react";

export type ToolPage = "board" | "fire" | "guide" | "flight";
export type Page = "home" | ToolPage;
export const pageNames: Record<Page, string> = {
  home: "Home",
  board: "Board",
  fire: "Fire support",
  flight: "Flight planner",
  guide: "Field guide",
};

export function pageFromHash(hash: string): Page {
  switch (hash) {
    case "#/flight":
      return "flight";
    case "#/board":
      return "board";
    case "#/fire":
      return "fire";
    case "#/layers":
      return "board";
    case "#/ops":
      return "board";
    case "#/guide":
      return "guide";
    default:
      return "home";
  }
}

function snapshot() {
  return pageFromHash(window.location.hash);
}
function subscribe(notify: () => void) {
  const update = () => {
    document.title = `${pageNames[snapshot()]} · WARBOARD`;
    notify();
  };
  update();
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
export function usePage() {
  return useSyncExternalStore(subscribe, snapshot);
}
export function navigate(page: Page) {
  const hash = `#/${page}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}
