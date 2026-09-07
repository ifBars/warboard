import { get, setMany } from "idb-keyval";
import { validatePlan, type Plan } from "./model";
import { createWriteQueue } from "./writeQueue";
const KEY = "fieldboard-plan-v1";
const writes = createWriteQueue<Plan>(async (values, latest) => {
  values.set(KEY, latest);
  await setMany([...values]);
});
if (typeof window !== "undefined")
  window.addEventListener("beforeunload", (event) => {
    if (writes.dirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
export const readPlan = async () => {
  const p = await get(KEY);
  return p ? validatePlan(p) : null;
};
export function savePlan(plan: Plan) {
  const key = ["Bakurani", "Ozeti"].includes(plan.map.name)
    ? `fieldboard-map-${plan.map.name}`
    : KEY;
  return writes.save(key, plan);
}
export function flushSaves() {
  return writes.flush();
}
export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function loadImage(file: File): Promise<Plan["map"]> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPG, or WebP image under 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width > 8192 ||
      bitmap.height > 8192 ||
      bitmap.width * bitmap.height > 25000000
    )
      throw new Error(
        "Use a map up to 8192 pixels per side and 25 megapixels total.",
      );
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read this image."));
      reader.readAsDataURL(file);
    });
    return {
      name: file.name,
      image,
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
