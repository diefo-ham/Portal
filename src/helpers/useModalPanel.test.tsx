// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useModalPanel } from "./useModalPanel";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

type Panel = "tools" | "details";
let api: ReturnType<typeof useModalPanel<Panel>>;

const Harness = () => {
  api = useModalPanel<Panel>();
  return (
    <>
      <button>opener</button>
      <dialog ref={api.dialog} onClose={api.onClosed}>
        <p>{api.panel ?? "none"}</p>
      </dialog>
    </>
  );
};

const dialog = () => document.querySelector("dialog")!;

describe("useModalPanel", () => {
  it("starts closed", () => {
    render(<Harness />);
    expect(api.panel).toBeNull();
    expect(dialog().open).toBe(false);
  });

  it("opens the dialog on the chosen panel", () => {
    render(<Harness />);
    act(() => api.open("tools"));
    expect(api.panel).toBe("tools");
    expect(api.parent).toBeNull();
    expect(dialog().open).toBe(true);
  });

  it("closes the dialog", () => {
    render(<Harness />);
    act(() => api.open("tools"));
    act(() => api.close());
    expect(api.panel).toBeNull();
    expect(dialog().open).toBe(false);
  });

  it("remembers the parent of a panel opened from another, and goes back", () => {
    render(<Harness />);
    act(() => api.open("tools"));
    act(() => api.openFrom("tools", "details"));
    expect(api.panel).toBe("details");
    expect(api.parent).toBe("tools");
    act(() => api.back());
    expect(api.panel).toBe("tools");
    expect(api.parent).toBeNull();
  });

  it("can switch panel without changing where Back leads", () => {
    render(<Harness />);
    act(() => api.openFrom("tools", "details"));
    act(() => api.show("tools"));
    expect(api.panel).toBe("tools");
    expect(api.parent).toBe("tools");
  });

  it("forgets the parent when a panel is opened directly", () => {
    render(<Harness />);
    act(() => api.openFrom("tools", "details"));
    act(() => api.open("tools"));
    expect(api.parent).toBeNull();
  });

  it("returns focus to what was focused when it opened", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    act(() => api.open("tools"));
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => api.onClosed());
    expect(document.activeElement).toBe(opener);
    expect(api.panel).toBeNull();
  });

  it("keeps the first opener when a second panel opens on top", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    act(() => api.open("tools"));
    document.body.focus();
    act(() => api.open("details"));
    act(() => api.onClosed());
    expect(document.activeElement).toBe(opener);
  });
});
