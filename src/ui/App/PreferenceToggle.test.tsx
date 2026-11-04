// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferenceToggle } from "./PreferenceToggle";

afterEach(cleanup);

describe("PreferenceToggle", () => {
  it("is a checkbox named by its label, with the hint beneath", () => {
    render(
      <PreferenceToggle
        checked={false}
        onChange={() => {}}
        label="Timer on by default"
        hint="New sessions start with the timer visible."
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "Timer on by default",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(
      screen.getByText("New sessions start with the timer visible."),
    ).toBeTruthy();
  });

  it("shows the checked state it is given", () => {
    render(<PreferenceToggle checked onChange={() => {}} label="A" hint="h" />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("reports the new value when toggled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <PreferenceToggle
        checked={false}
        onChange={onChange}
        label="A"
        hint="h"
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(
      <PreferenceToggle checked onChange={onChange} label="A" hint="h" />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles from a click on the label text", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PreferenceToggle
        checked={false}
        onChange={onChange}
        label="Click me"
        hint="h"
      />,
    );
    await user.click(screen.getByText("Click me"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
