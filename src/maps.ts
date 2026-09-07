import { assetUrl } from "./assetUrl";
import { get } from "idb-keyval";
import { validatePlan, type Plan } from "./model";
export const builtIns = [
  { id: "bakurani", name: "Bakurani" },
  { id: "ozeti", name: "Ozeti" },
] as const;
export async function openMap(id: string): Promise<Plan> {
  const entry = builtIns.find((m) => m.id === id);
  if (!entry) throw new Error("Unknown map.");
  try {
    const saved = await get(`fieldboard-map-${entry.name}`);
    if (saved) return validatePlan(saved);
  } catch {
    /* The bundled map remains usable without storage. */
  }
  const response = await fetch(assetUrl(`/maps/${entry.id}.webp`));
  if (!response.ok)
    throw new Error(
      `Could not load ${entry.name}. Restart the app and try again.`,
    );
  const blob = await response.blob();
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    version: 1,
    name: `${entry.name} plan`,
    map: { name: entry.name, image, width: 4096, height: 4096 },
    marks: [],
  };
}
