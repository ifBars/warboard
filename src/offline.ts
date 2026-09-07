import { assetUrl } from "./assetUrl";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type OfflineState = {
  phase: "development" | "preparing" | "ready" | "unavailable";
  canInstall: boolean;
  update: boolean;
};
let state: OfflineState = {
  phase: import.meta.env.PROD ? "preparing" : "development",
  canInstall: false,
  update: false,
};
let installEvent: InstallEvent | null = null,
  registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<() => void>();
const publish = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
export const offlineSnapshot = () => state;
export const subscribeOffline = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export async function startOffline() {
  if (!import.meta.env.PROD) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    publish({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    publish({ canInstall: false });
  });
  if (!("serviceWorker" in navigator)) {
    publish({ phase: "unavailable" });
    return;
  }
  try {
    registration = await navigator.serviceWorker.register(assetUrl("/sw.js"));
    if (registration.waiting) publish({ update: true });
    const observeInstall = () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          publish({ update: true });
      });
    };
    registration.addEventListener("updatefound", observeInstall);
    observeInstall();
    let timer = 0;
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("Offline preparation timed out")),
            30000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    publish({ phase: "ready" });
  } catch {
    publish({ phase: "unavailable" });
  }
}
export async function installApp() {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  publish({ canInstall: false });
}
export function activateUpdate() {
  if (!registration?.waiting) return;
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => location.reload(),
    { once: true },
  );
  registration.waiting.postMessage("ACTIVATE_UPDATE");
}
