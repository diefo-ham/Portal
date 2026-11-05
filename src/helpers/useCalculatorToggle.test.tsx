// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  useCalculatorToggle,
  type CalculatorToggleOptions,
} from "./useCalculatorToggle";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    fn(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const options = (
  overrides: Partial<CalculatorToggleOptions> = {},
): CalculatorToggleOptions => ({
  available: true,
  blocked: false,
  paused: false,
  work: { flush: vi.fn().mockResolvedValue(undefined) },
  returnFocus: () => null,
  focusAfterClose: () => null,
  ...overrides,
});

const backslash = (init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", {
    code: "Backslash",
    key: "\\",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("useCalculatorToggle", () => {
  it("starts closed, and opens with autofocus from its button", () => {
    const { result } = renderHook(() => useCalculatorToggle(options()));
    expect(result.current.open).toBe(false);
    expect(result.current.visible).toBe(false);
    act(() => result.current.show());
    expect(result.current.open).toBe(true);
    expect(result.current.visible).toBe(true);
    expect(result.current.autoFocus).toBe(true);
  });

  it("is never visible where it is not offered", () => {
    const { result } = renderHook(() =>
      useCalculatorToggle(options({ available: false })),
    );
    act(() => result.current.show());
    expect(result.current.visible).toBe(false);
  });

  it("saves its work and moves focus when closed", () => {
    const target = document.createElement("button");
    document.body.append(target);
    const opts = options({ focusAfterClose: () => target });
    const { result } = renderHook(() => useCalculatorToggle(opts));
    act(() => result.current.show());
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    expect(opts.work.flush).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(target);
  });

  it("hides without saving", () => {
    const opts = options();
    const { result } = renderHook(() => useCalculatorToggle(opts));
    act(() => result.current.show());
    act(() => result.current.hide());
    expect(result.current.open).toBe(false);
    expect(opts.work.flush).not.toHaveBeenCalled();
  });

  it("toggles with \\ without autofocus, keeping focus where it was", () => {
    const field = document.createElement("button");
    document.body.append(field);
    field.focus();
    const { result } = renderHook(() => useCalculatorToggle(options()));
    const event = backslash();
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.open).toBe(true);
    expect(result.current.autoFocus).toBe(false);
    expect(document.activeElement).toBe(field);
    backslash();
    expect(result.current.open).toBe(false);
  });

  it("saves the work when \\ closes it", () => {
    const opts = options();
    const { result } = renderHook(() => useCalculatorToggle(opts));
    backslash();
    backslash();
    expect(result.current.open).toBe(false);
    expect(opts.work.flush).toHaveBeenCalledOnce();
  });

  it("ignores \\ with a modifier, a repeat, or a dialog open", () => {
    const { result } = renderHook(() => useCalculatorToggle(options()));
    backslash({ shiftKey: true });
    backslash({ ctrlKey: true });
    backslash({ altKey: true });
    backslash({ metaKey: true });
    expect(result.current.open).toBe(false);
    backslash({ repeat: true });
    expect(result.current.open).toBe(false);
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.append(modal);
    backslash();
    expect(result.current.open).toBe(false);
  });

  it("ignores other keys", () => {
    const { result } = renderHook(() => useCalculatorToggle(options()));
    backslash({ code: "Slash", key: "/" });
    expect(result.current.open).toBe(false);
  });

  it("does nothing on \\ while blocked or unavailable", () => {
    const blocked = renderHook(() =>
      useCalculatorToggle(options({ blocked: true })),
    );
    backslash();
    expect(blocked.result.current.open).toBe(false);
    blocked.unmount();
    const unavailable = renderHook(() =>
      useCalculatorToggle(options({ available: false })),
    );
    backslash();
    expect(unavailable.result.current.open).toBe(false);
  });

  it("closes when the session pauses", () => {
    const { result, rerender } = renderHook(
      (props: { paused: boolean }) =>
        useCalculatorToggle(options({ paused: props.paused })),
      { initialProps: { paused: false } },
    );
    act(() => result.current.show());
    rerender({ paused: true });
    expect(result.current.open).toBe(false);
  });

  it("stops listening when unmounted", () => {
    const { result, unmount } = renderHook(() =>
      useCalculatorToggle(options()),
    );
    unmount();
    const event = backslash();
    expect(event.defaultPrevented).toBe(false);
    expect(result.current.open).toBe(false);
  });
});
