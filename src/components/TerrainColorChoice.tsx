import { terrainColorAvailable } from "../mapImagery";
export default function TerrainColorChoice({
  enabled,
  onChange,
  lighting,
  onLightingChange,
  treeOutlines,
  onTreeOutlines,
}: {
  enabled: boolean;
  treeOutlines?: boolean;
  onTreeOutlines?: (value: boolean) => void;
  lighting?: boolean;
  onLightingChange?: (value: boolean) => void;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="terrain-color-choice">
      <label>
        Map appearance
        <select
          aria-label="Map appearance"
          value={terrainColorAvailable && enabled ? "color" : "gray"}
          disabled={!terrainColorAvailable}
          onChange={(e) => onChange(e.target.value === "color")}
        >
          <option value="gray">Grayscale</option>
          <option value="color">Terrain color (test)</option>
        </select>
      </label>
      {onLightingChange && (
        <label>
          <input
            type="checkbox"
            checked={lighting ?? true}
            onChange={(e) => onLightingChange(e.target.checked)}
          />{" "}
          Terrain lighting <small>Relief shading in 3D and Flight views.</small>
        </label>
      )}
      {onTreeOutlines && (
        <label>
          <input
            type="checkbox"
            aria-label="Show tree outlines"
            checked={treeOutlines ?? false}
            onChange={(e) => onTreeOutlines(e.target.checked)}
          />{" "}
          Show tree outlines{" "}
          <small>Visibility only; route clearance checks remain active.</small>
        </label>
      )}
      <small>
        Community imagery · 16K Bakurani / 32K Ozeti. Test layer shared by
        u/blahajSupremacy.
      </small>
    </div>
  );
}
