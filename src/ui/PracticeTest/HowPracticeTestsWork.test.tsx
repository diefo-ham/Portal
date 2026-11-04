// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HowPracticeTestsWork } from "./HowPracticeTestsWork";

afterEach(cleanup);

describe("HowPracticeTestsWork", () => {
  it("is a collapsed disclosure with a summary", () => {
    const { container } = render(<HowPracticeTestsWork />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(screen.getByText("How Practice Tests work")).toBeTruthy();
  });

  it("explains the module order, adaptive routing, unscored items and reuse", () => {
    render(<HowPracticeTestsWork />);
    expect(screen.getByText(/A Full Test moves through/)).toBeTruthy();
    expect(screen.getByText(/Module 2 adapts to scored Module 1/)).toBeTruthy();
    expect(
      screen.getByText(/Exactly two randomly chosen questions/),
    ).toBeTruthy();
    expect(screen.getByText(/stay used for Practice Tests/)).toBeTruthy();
  });
});
