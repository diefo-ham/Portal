// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBusy } from "./useBusy";

/** A promise the test settles by hand, so "while running" can be observed. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useBusy", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useBusy());
    expect(result.current[0]).toBe(false);
  });

  it("is busy while the action runs and idle after it finishes", async () => {
    const { result } = renderHook(() => useBusy());
    const job = deferred<string>();
    let outcome!: Promise<string>;
    act(() => {
      outcome = result.current[1](() => job.promise);
    });
    expect(result.current[0]).toBe(true);
    await act(async () => {
      job.resolve("done");
      await outcome;
    });
    expect(result.current[0]).toBe(false);
    await expect(outcome).resolves.toBe("done");
  });

  it("returns what the action returns", async () => {
    const { result } = renderHook(() => useBusy());
    let value: number | undefined;
    await act(async () => {
      value = await result.current[1](async () => 42);
    });
    expect(value).toBe(42);
  });

  it("clears the flag and rethrows when the action fails", async () => {
    const { result } = renderHook(() => useBusy());
    const failure = new Error("nope");
    let caught: unknown;
    await act(async () => {
      try {
        await result.current[1](async () => {
          throw failure;
        });
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toBe(failure);
    expect(result.current[0]).toBe(false);
  });
});
