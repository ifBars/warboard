// Tactical marker symbols. Ids are stored in plans; keep them stable.
export const markerSymbols = [
  { id: "infantry", label: "Infantry" },
  { id: "sniper", label: "Overwatch" },
  { id: "vehicle", label: "Vehicle" },
  { id: "helicopter", label: "Helicopter" },
  { id: "mortar", label: "Mortar / artillery" },
  { id: "antiair", label: "Anti-air" },
  { id: "fob", label: "FOB" },
  { id: "objective", label: "Objective" },
  { id: "attack", label: "Attack" },
  { id: "defend", label: "Defend" },
  { id: "rally", label: "Rally point" },
  { id: "lz", label: "Landing zone" },
  { id: "supply", label: "Supply" },
  { id: "medic", label: "Medic" },
  { id: "observe", label: "Spotted" },
  { id: "enemy", label: "Enemy" },
  { id: "danger", label: "Danger" },
] as const;
export type MarkerSymbol = (typeof markerSymbols)[number]["id"];
export const isMarkerSymbol = (value: unknown): value is MarkerSymbol =>
  markerSymbols.some((s) => s.id === value);
export const markerLabel = (symbol: MarkerSymbol | undefined) =>
  markerSymbols.find((s) => s.id === symbol)?.label ?? "Marker";
