import lonestar from "./assets/map-icons/faction-lonestar.webp?inline";
import valkyra from "./assets/map-icons/faction-valkyra.webp?inline";
import manticore from "./assets/map-icons/faction-manticore.webp?inline";
export const factionIcons = { lonestar, valkyra, manticore };
export function factionIcon(label: string): string | undefined {
  return Object.entries(factionIcons).find(([name]) =>
    label.toLowerCase().includes(name),
  )?.[1];
}
