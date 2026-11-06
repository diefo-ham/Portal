// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useClickOutside } from "./useClickOutside";

afterEach(cleanup);

const Menu = ({
  open,
  onOutside,
}: {
  open: boolean;
  onOutside: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, onOutside);
  return (
    <>
      <div ref={ref}>
        <button>inside</button>
      </div>
      <button>outside</button>
    </>
  );
};

const press = (name: string) =>
  fireEvent.pointerDown(screen.getByRole("button", { name }));

describe("useClickOutside", () => {
  it("reports a press outside while active", () => {
    const onOutside = vi.fn();
    render(<Menu open onOutside={onOutside} />);
    press("outside");
    expect(onOutside).toHaveBeenCalledOnce();
  });

  it("ignores a press inside", () => {
    const onOutside = vi.fn();
    render(<Menu open onOutside={onOutside} />);
    press("inside");
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("does nothing while inactive", () => {
    const onOutside = vi.fn();
    render(<Menu open={false} onOutside={onOutside} />);
    press("outside");
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("starts and stops listening as it is activated", () => {
    const onOutside = vi.fn();
    const { rerender } = render(<Menu open={false} onOutside={onOutside} />);
    rerender(<Menu open onOutside={onOutside} />);
    press("outside");
    rerender(<Menu open={false} onOutside={onOutside} />);
    press("outside");
    expect(onOutside).toHaveBeenCalledOnce();
  });

  it("calls the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Menu open onOutside={first} />);
    rerender(<Menu open onOutside={second} />);
    press("outside");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("stops listening when unmounted", () => {
    const onOutside = vi.fn();
    const { unmount } = render(<Menu open onOutside={onOutside} />);
    unmount();
    fireEvent.pointerDown(document.body);
    expect(onOutside).not.toHaveBeenCalled();
  });
});
