import { useSyncExternalStore } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { flushSaves } from "../storage";
import {
  activateUpdate,
  installApp,
  offlineSnapshot,
  subscribeOffline,
} from "../offline";
export default function OfflineStatus({
  onError,
}: {
  onError: (s: string) => void;
}) {
  const state = useSyncExternalStore(
    subscribeOffline,
    offlineSnapshot,
    offlineSnapshot,
  );
  if (state.phase === "development") return null;
  if (state.update)
    return (
      <button
        type="button"
        className="offline-action"
        title="Activate the downloaded update and reload"
        onClick={() =>
          void flushSaves()
            .then(activateUpdate)
            .catch(() =>
              onError(
                "The latest save failed. Export your plan before updating.",
              ),
            )
        }
      >
        <RefreshCw size={15} />
        <span>Update ready</span>
      </button>
    );
  if (state.canInstall)
    return (
      <button
        type="button"
        className="offline-action"
        title="Install WARBOARD as a standalone app"
        onClick={() => void installApp().catch(() => {})}
      >
        <Download size={15} />
        <span>Install app</span>
      </button>
    );
  return (
    <span
      className="offline-state"
      title={
        state.phase === "ready"
          ? "Base maps and app are cached. Recent detail and terrain files are cached as you use them."
          : state.phase === "preparing"
            ? "Saving base maps for offline use"
            : "Offline caching is unavailable in this browser"
      }
    >
      <WifiOff size={14} />
      <span>
        {state.phase === "ready"
          ? "Offline ready"
          : state.phase === "preparing"
            ? "Preparing offline…"
            : "Online only"}
      </span>
    </span>
  );
}
