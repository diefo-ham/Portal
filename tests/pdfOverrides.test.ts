import { describe, expect, it } from "vitest";
import { parseOverrides } from "../src/importing/pdf/prepare.ts";

describe("parseOverrides", () => {
  it("accepts reviewed exceptions and rejects anything else", () => {
    expect(
      parseOverrides({
        e3bbf2bf: { choiceLabelsVerified: true, warning: "Bullet is D." },
      }),
    ).toEqual({
      e3bbf2bf: { choiceLabelsVerified: true, warning: "Bullet is D." },
    });
    expect(() => parseOverrides([])).toThrow("JSON object");
    expect(() => parseOverrides({ "bad id": {} })).toThrow("valid source ID");
    expect(() => parseOverrides({ abcd1234: "x" })).toThrow(
      "must be an object",
    );
    expect(() =>
      parseOverrides({ abcd1234: { choiceLabelsVerified: "yes" } }),
    ).toThrow("true or false");
    expect(() =>
      parseOverrides({ abcd1234: { warning: "x".repeat(501) } }),
    ).toThrow("at most 500");
  });
});
