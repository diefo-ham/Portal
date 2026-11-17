// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RotateHint } from "./RotateHint";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("RotateHint", () => {
  it("suggests turning the phone", () => {
    render(<RotateHint />);
    expect(
      screen.getByText("Turn your phone sideways for larger text."),
    ).toBeTruthy();
  });

  it("goes away when hidden, and stays away on the next question", async () => {
    const first = render(<RotateHint />);
    await userEvent.click(
      screen.getByRole("button", { name: "Hide this tip" }),
    );
    expect(first.container.textContent).toBe("");
    expect(localStorage.getItem("sat-rotate-hint")).toBe("off");
    cleanup();
    expect(render(<RotateHint />).container.textContent).toBe("");
  });
});
