import { expect, test } from "bun:test";
import { planBriefing } from "./briefing";
import { emptyMission } from "./ballistics";
import { emptyOperations } from "./operations";

test("portable briefing keeps coordinates, checks and resource shortfalls together", () => {
  const operations = emptyOperations();
  operations.briefing = "Hold the bridge";
  operations.tasks = [{ id: "a", text: "Check ammo", done: true }];
  operations.supplies.Ammo = { required: 1000, packed: 700 };
  const text = planBriefing({
    version: 1,
    name: "Bridge defense",
    map: {
      name: "Bakurani",
      width: 4096,
      height: 4096,
      image: "data:image/webp;base64,AAAA",
    },
    marks: [],
    operations,
    mission: {
      ...emptyMission(),
      gun: { x: 80, y: 80 },
      target: { x: 80, y: 85 },
    },
  });
  expect(text).toContain("Hold the bridge");
  expect(text).toContain("[x] Check ammo");
  expect(text).toContain("500 m · bearing 0.0°");
  expect(text).toContain("Elevation: 461 MIL");
  expect(text).toContain("700 packed / 1000 requested; 300 short");
  expect(text).toContain("Temporary spotter corrections are not included");
});
