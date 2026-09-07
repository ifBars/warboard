import { expect, test } from "bun:test";
import { pageFromHash } from "./navigation";

test("bookmarked tool routes reopen their tool and unknown routes return home", () => {
  expect(pageFromHash("#/fire")).toBe("fire");
  expect(pageFromHash("#/flight")).toBe("flight");
  expect(pageFromHash("#/ops")).toBe("board");
  expect(pageFromHash("#/board")).toBe("board");
  expect(pageFromHash("#/layers")).toBe("board");
  expect(pageFromHash("#/guide")).toBe("guide");
  expect(pageFromHash("")).toBe("home");
  expect(pageFromHash("#/home")).toBe("home");
  expect(pageFromHash("#/unknown")).toBe("home");
});
