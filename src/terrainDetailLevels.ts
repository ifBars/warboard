const levelLimits = {
  bakurani: { min: 4, max: 5 },
  ozeti: { min: 4, max: 6 },
  zestafona: { min: 4, max: 4 },
} as const;

type ColorMapId = keyof typeof levelLimits;

function isColorMapId(map: string): map is ColorMapId {
  return Object.hasOwn(levelLimits, map);
}

export function terrainDetailLevel(
  map: string,
  pixelsAcrossMap: number,
): number | null {
  if (!isColorMapId(map)) return null;
  const { min, max } = levelLimits[map];
  const pixels = Number.isFinite(pixelsAcrossMap)
    ? Math.max(1, pixelsAcrossMap)
    : 1;
  return Math.min(max, Math.max(min, Math.ceil(Math.log2(pixels / 512))));
}
