import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { readJson, readStorage, writeJson, writeStorage } from "./storage";

/** A minimal in-memory Storage so these tests run in Node. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("with working storage", () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
  });

  it("round-trips strings", () => {
    expect(readStorage("k")).toBeNull();
    expect(writeStorage("k", "v")).toBe(true);
    expect(readStorage("k")).toBe("v");
    expect(storage.data.get("k")).toBe("v");
  });

  it("overwrites an existing value", () => {
    writeStorage("k", "one");
    writeStorage("k", "two");
    expect(readStorage("k")).toBe("two");
  });

  it("round-trips JSON values", () => {
    const value = { x: 1, y: [2, 3], nested: { ok: true } };
    expect(writeJson("g", value)).toBe(true);
    expect(readJson("g")).toEqual(value);
  });

  it("returns undefined for a missing JSON key", () => {
    expect(readJson("nothing")).toBeUndefined();
  });

  it("returns undefined for invalid JSON instead of throwing", () => {
    storage.data.set("bad", "{not json");
    expect(readJson("bad")).toBeUndefined();
  });

  it("reads a stored JSON null as null, distinct from missing", () => {
    writeJson("n", null);
    expect(readJson("n")).toBeNull();
  });

  it("reports failure when a value cannot be serialised", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson("c", circular)).toBe(false);
    expect(readStorage("c")).toBeNull();
  });
});

describe("when storage throws (blocked site data, full quota)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });
  });

  it("reads as empty", () => {
    expect(readStorage("k")).toBeNull();
    expect(readJson("k")).toBeUndefined();
  });

  it("reports that nothing was saved", () => {
    expect(writeStorage("k", "v")).toBe(false);
    expect(writeJson("k", { a: 1 })).toBe(false);
  });
});

describe("when storage does not exist", () => {
  it("behaves as if empty", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readStorage("k")).toBeNull();
    expect(readJson("k")).toBeUndefined();
    expect(writeStorage("k", "v")).toBe(false);
    expect(writeJson("k", 1)).toBe(false);
  });
});
