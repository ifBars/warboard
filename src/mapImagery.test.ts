import { expect, test } from "bun:test";
import { mapImage, detailImagery } from "./mapImagery";
test("sourced imagery preserves the plan map and never selects detection-only assets", () => {
  const map = {
    name: "Bakurani",
    image: "data:image/webp;base64,AA==",
    width: 4096,
    height: 4096,
  };
  expect(mapImage(map, false)).toBe(map.image);
  expect(mapImage(map, true)).toBe("/maps/community-color/bakurani.webp");
  expect(mapImage({ ...map, name: "Ozeti" }, true)).toBe(
    "/maps/community-color/ozeti.webp",
  );
  expect(mapImage({ ...map, name: "Custom" }, true)).toBe(map.image);
  expect(mapImage({ ...map, width: 2048 }, true)).toBe(map.image);
  expect(detailImagery(map, true)).toEqual({
    count: 8,
    path: "/maps/community-color/bakurani_files/3",
  });
  expect(detailImagery(map, false)?.count).toBe(32);
  expect(detailImagery(map, true, 2)?.count).toBe(16);
  expect(detailImagery(map, true, 100)?.count).toBe(32);
  expect(detailImagery({ ...map, name: "Ozeti" }, true, 100)).toEqual({
    count: 64,
    path: "/maps/community-color/ozeti_files/6",
  });
});
