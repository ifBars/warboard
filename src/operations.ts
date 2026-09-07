export const resourceNames = [
  "Ammo",
  "Building",
  "Fuel",
  "Mechanical",
] as const;
export type Resource = (typeof resourceNames)[number];
export type Operations = {
  briefing: string;
  tasks: { id: string; text: string; done: boolean }[];
  supplies: Record<Resource, { required: number; packed: number }>;
  budget: { cash: number; reserve: number; kit: number; transport: number };
};
export const emptyOperations = (): Operations => ({
  briefing: "",
  tasks: [],
  supplies: {
    Ammo: { required: 0, packed: 0 },
    Building: { required: 0, packed: 0 },
    Fuel: { required: 0, packed: 0 },
    Mechanical: { required: 0, packed: 0 },
  },
  budget: { cash: 0, reserve: 0, kit: 0, transport: 0 },
});
export function budgetSummary(b: Operations["budget"]) {
  return {
    after: b.cash - b.kit - b.transport,
    deployments:
      b.kit > 0
        ? Math.floor(Math.max(0, b.cash - b.reserve - b.transport) / b.kit)
        : null,
    shortfall: Math.max(0, b.reserve + b.kit + b.transport - b.cash),
  };
}
export const checklists = {
  Infantry: [
    "Agree on a rally point and fallback route",
    "Check compatible ammo and magazines",
    "Pack medical supplies",
    "Confirm transport and squad comms",
  ],
  "Fire support": [
    "Confirm map, gun and target coordinates",
    "Check FOB ammo or vehicle ammunition",
    "Check terrain and vehicle level",
    "Confirm friendly positions with spotter",
    "Fire and observe one ranging shot",
    "Call the correction before a salvo",
  ],
  Logistics: [
    "Ask the FOB crew what resource is needed",
    "Mark the destination and delivery approach",
    "Pack the requested resource types",
    "Check fuel and transport capacity",
    "Confirm supplies were received",
  ],
};
