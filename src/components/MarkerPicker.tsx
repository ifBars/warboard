import { markerSymbols, type MarkerSymbol } from "../markers";
import { markerIcons } from "./markerIcons";

export default function MarkerPicker({
  value,
  onPick,
}: {
  value: MarkerSymbol;
  onPick: (symbol: MarkerSymbol) => void;
}) {
  return (
    <>
      <label id="marker-symbol-label">Marker symbol</label>
      <div
        className="marker-symbols"
        role="group"
        aria-labelledby="marker-symbol-label"
      >
        {markerSymbols.map((m) => {
          const Icon = markerIcons[m.id];
          return (
            <button
              type="button"
              key={m.id}
              title={m.label}
              aria-pressed={value === m.id}
              onClick={() => onPick(m.id)}
            >
              <Icon size={17} aria-hidden />
              <span className="sr-only">{m.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
