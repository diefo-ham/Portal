// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePersistedBoolean } from "./usePersistedBoolean";

/** A minimal in-memory Storage. */
const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe("usePersistedBoolean", () => {
  describe("a setting that is on by default", () => {
    it("is on when nothing is stored", () => {
      vi.stubGlobal("localStorage", memoryStorage());
      const { result } = renderHook(() => usePersistedBoolean("k", true));
      expect(result.current[0]).toBe(true);
    });

    it("is off only when stored as the text false", () => {
      vi.stubGlobal("localStorage", memoryStorage({ k: "false" }));
      const { result } = renderHook(() => usePersistedBoolean("k", true));
      expect(result.current[0]).toBe(false);
    });

    it.each(["true", "yes", "", "0"])("stays on for a stored %j", (stored) => {
      vi.stubGlobal("localStorage", memoryStorage({ k: stored }));
      const { result } = renderHook(() => usePersistedBoolean("k", true));
      expect(result.current[0]).toBe(true);
    });
  });

  describe("a setting that is off by default", () => {
    it("is off when nothing is stored", () => {
      vi.stubGlobal("localStorage", memoryStorage());
      const { result } = renderHook(() => usePersistedBoolean("k", false));
      expect(result.current[0]).toBe(false);
    });

    it("is on only when stored as the text true", () => {
      vi.stubGlobal("localStorage", memoryStorage({ k: "true" }));
      const { result } = renderHook(() => usePersistedBoolean("k", false));
      expect(result.current[0]).toBe(true);
    });

    it.each(["false", "yes", "", "1"])(
      "stays off for a stored %j",
      (stored) => {
        vi.stubGlobal("localStorage", memoryStorage({ k: stored }));
        const { result } = renderHook(() => usePersistedBoolean("k", false));
        expect(result.current[0]).toBe(false);
      },
    );
  });

  describe("changing it", () => {
    let storage: ReturnType<typeof memoryStorage>;
    beforeEach(() => {
      storage = memoryStorage();
      vi.stubGlobal("localStorage", storage);
    });

    it("updates the value and stores it", () => {
      const { result } = renderHook(() => usePersistedBoolean("k", true));
      act(() => result.current[1](false));
      expect(result.current[0]).toBe(false);
      expect(storage.data.get("k")).toBe("false");
      act(() => result.current[1](true));
      expect(result.current[0]).toBe(true);
      expect(storage.data.get("k")).toBe("true");
    });

    it("is remembered by the next reader", () => {
      const first = renderHook(() => usePersistedBoolean("k", false));
      act(() => first.result.current[1](true));
      const second = renderHook(() => usePersistedBoolean("k", false));
      expect(second.result.current[0]).toBe(true);
    });

    it("keeps separate keys apart", () => {
      const a = renderHook(() => usePersistedBoolean("a", false));
      const b = renderHook(() => usePersistedBoolean("b", false));
      act(() => a.result.current[1](true));
      expect(a.result.current[0]).toBe(true);
      expect(b.result.current[0]).toBe(false);
    });
  });

  it("still works for this visit when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    const { result } = renderHook(() => usePersistedBoolean("k", true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
