import { expect, test } from "bun:test";
import { createWriteQueue } from "./writeQueue";

test("rapid edits save the newest value for every map before flush completes", async () => {
  const values = new Map<string, number>();
  let finish: () => void = () => {};
  let calls = 0,
    active = 0;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const queue = createWriteQueue<number>(async (batch, latest) => {
    calls++;
    if (calls === 1) await gate;
    batch.forEach((value, key) => values.set(key, value));
    active = latest;
  });
  const jobs = [
    queue.save("bakurani", 1),
    queue.save("bakurani", 2),
    queue.save("bakurani", 3),
    queue.save("ozeti", 4),
  ];
  expect(queue.dirty()).toBe(true);
  finish();
  await queue.flush();
  await Promise.all(jobs);
  expect(calls).toBe(2);
  expect(values.get("bakurani")).toBe(3);
  expect(values.get("ozeti")).toBe(4);
  expect(active).toBe(4);
  expect(queue.dirty()).toBe(false);
});

test("storage failure stays dirty, rejects saves and flush, and permits recovery", async () => {
  let fail = true;
  const queue = createWriteQueue<number>(async () => {
    if (fail) throw new Error("Quota exceeded");
  });
  await expect(queue.save("a", 1)).rejects.toThrow("Quota exceeded");
  await expect(queue.flush()).rejects.toThrow("Quota exceeded");
  expect(queue.dirty()).toBe(true);
  fail = false;
  await queue.save("a", 2);
  await queue.flush();
  expect(queue.dirty()).toBe(false);
});
