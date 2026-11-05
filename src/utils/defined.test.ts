import { describe, expect, it } from "vitest";
import { defined } from "./defined";

describe("defined", () => {
  it("returns a value that is there", () => {
    expect(defined(3, "Three")).toBe(3);
    const question = { id: "q" };
    expect(defined(question, "Question")).toBe(question);
  });

  it("keeps falsy values that are real values", () => {
    expect(defined(0, "Zero")).toBe(0);
    expect(defined("", "Empty")).toBe("");
    expect(defined(false, "False")).toBe(false);
  });

  it("throws a clear error for a missing value", () => {
    expect(() => defined(undefined, "This question")).toThrow(
      "This question no longer exists.",
    );
    expect(() => defined(null, "This session")).toThrow(
      "This session no longer exists.",
    );
  });

  it("works on lookups", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(
      defined(
        items.find((i) => i.id === "b"),
        "Item",
      ).id,
    ).toBe("b");
    expect(() =>
      defined(
        items.find((i) => i.id === "z"),
        "Item",
      ),
    ).toThrow("Item no longer exists.");
  });
});
