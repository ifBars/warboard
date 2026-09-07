import { Map, RefreshCw } from "lucide-react";
export default function TerrainLoading({
  mapName,
  error,
  onRetry,
  title = "Preparing terrain",
  backToBoard = false,
}: {
  mapName: string;
  error?: string;
  onRetry?: () => void;
  title?: string;
  backToBoard?: boolean;
}) {
  return (
    <section className="terrain-loading" aria-busy={!error}>
      <div className="terrain-loading-grid" aria-hidden="true">
        <div className="terrain-loading-cross" />
      </div>
      <div className="terrain-loading-content">
        <span className="terrain-loading-eyebrow">WARBOARD / {mapName}</span>
        <Map size={30} strokeWidth={1.4} aria-hidden="true" />
        <h2>{error ? "Terrain unavailable" : title}</h2>
        <p role="status">{error || "Loading elevation and map details."}</p>
        {!error && (
          <div className="terrain-loading-track" aria-hidden="true">
            <span />
          </div>
        )}
        {error && onRetry && (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={16} /> Retry terrain
          </button>
        )}
        {backToBoard && <a href="#/board">Back to Board</a>}
      </div>
    </section>
  );
}
