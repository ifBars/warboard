import { get, set, setMany, del } from "idb-keyval";
import { validatePlan, type Plan } from "./model";
export type SavedPlan = {
  id: string;
  name: string;
  map: string;
  marks: number;
  updated: number;
};
const INDEX = "warboard-library-v1";
export async function listPlans(): Promise<SavedPlan[]> {
  const index = await get(INDEX);
  if (index === undefined) return [];
  if (
    !Array.isArray(index) ||
    index.length > 30 ||
    index.some(
      (p) =>
        !p ||
        typeof p.id !== "string" ||
        !/^[\w-]{1,80}$/.test(p.id) ||
        typeof p.name !== "string" ||
        typeof p.map !== "string" ||
        !Number.isFinite(p.updated) ||
        !Number.isInteger(p.marks),
    )
  )
    throw new Error(
      "The saved-plan index could not be read. Your current plan is still available; export a backup.",
    );
  return index;
}
export async function saveSnapshot(plan: Plan, name: string) {
  const index = await listPlans();
  if (index.length >= 30)
    throw new Error(
      "The library holds 30 plans. Export or remove an older snapshot first.",
    );
  const snapshot = { ...plan, name: name.trim().slice(0, 120) || plan.name };
  const summary = {
    id: crypto.randomUUID(),
    name: snapshot.name,
    map: plan.map.name,
    marks: plan.marks.length,
    updated: Date.now(),
  };
  await setMany([
    [`warboard-snapshot-${summary.id}`, snapshot],
    [INDEX, [summary, ...index]],
  ]);
  return [summary, ...index];
}
export async function loadSnapshot(id: string) {
  return validatePlan(await get(`warboard-snapshot-${id}`));
}
export async function deleteSnapshot(id: string) {
  const index = (await listPlans()).filter((p) => p.id !== id);
  await set(INDEX, index);
  await del(`warboard-snapshot-${id}`);
  return index;
}
