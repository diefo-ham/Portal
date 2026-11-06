// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ASSESSMENTS, assessmentInfo } from "../../core/assessments";
import type { Assessment } from "../../core/model";
import { AssessmentProvider, translator } from "../i18n";
import { AppHeader, type AppHeaderProps } from "./AppHeader";

afterEach(cleanup);

const setup = (
  overrides: Partial<AppHeaderProps> = {},
  assessment: Assessment = "SAT",
) => {
  const props: AppHeaderProps = {
    info: assessmentInfo(assessment),
    assessments: ASSESSMENTS.map(assessmentInfo),
    page: "home",
    testOpen: false,
    onHome: vi.fn(),
    onNavigate: vi.fn(),
    onSwitchAssessment: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <AssessmentProvider value={assessment}>
      <AppHeader {...props} />
    </AssessmentProvider>,
  );
  return { props, user };
};

const nav = () => screen.getByRole("navigation");
const current = () =>
  within(nav())
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "page")
    .map((b) => b.textContent);

describe("AppHeader", () => {
  it("shows the test's name as the brand and goes home from it", async () => {
    const { props, user } = setup();
    const brand = screen.getByRole("button", { name: /SAT Study/ });
    expect(brand.querySelector(".brand-icon")!.textContent).toBe("S");
    await user.click(brand);
    expect(props.onHome).toHaveBeenCalledOnce();
  });

  it("lists every test, marks the current one and switches to another", async () => {
    const { props, user } = setup();
    const group = screen.getByRole("group", { name: "Choose a test" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["SAT", "PAA", "TSI"]);
    expect(
      within(group)
        .getByRole("button", { name: "Test: SAT" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await user.click(
      within(group).getByRole("button", { name: "Switch to PAA" }),
    );
    expect(props.onSwitchAssessment).toHaveBeenCalledWith("PAA");
    await user.click(
      within(group).getByRole("button", { name: "Switch to TSI" }),
    );
    expect(props.onSwitchAssessment).toHaveBeenCalledWith("TSI");
  });

  it("does not switch when the current test is pressed", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Test: SAT" }));
    expect(props.onSwitchAssessment).not.toHaveBeenCalled();
  });

  it("follows the PAA's Spanish and switches back to the SAT", async () => {
    const { props, user } = setup({}, "PAA");
    expect(screen.getByRole("button", { name: /PAA Study/ })).toBeTruthy();
    const label = translator("PAA")("Switch to {other}", { other: "SAT" });
    await user.click(screen.getByRole("button", { name: label }));
    expect(props.onSwitchAssessment).toHaveBeenCalledWith("SAT");
  });

  it("lists the SAT's sections in order, ending with Tests", () => {
    setup();
    const labels = within(nav())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels.slice(0, 4)).toEqual([
      "Practice",
      "Review",
      "Browse",
      "Tests",
    ]);
  });

  it("calls the PAA's timed mode Test mode, in Spanish", () => {
    setup({}, "PAA");
    const t = translator("PAA");
    expect(screen.getByRole("button", { name: t("Test mode") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tests" })).toBeNull();
  });

  it("navigates to a section by its id", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Browse" }));
    await user.click(screen.getByRole("button", { name: "Tests" }));
    await user.click(screen.getByRole("button", { name: "Practice" }));
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(vi.mocked(props.onNavigate).mock.calls.map((c) => c[0])).toEqual([
      "library",
      "tests",
      "home",
      "review",
    ]);
  });

  it("opens Settings from the gear", async () => {
    const { props, user } = setup();
    const gear = screen.getByRole("button", { name: "Settings" });
    expect(gear.textContent).toBe("⚙");
    await user.click(gear);
    expect(props.onNavigate).toHaveBeenCalledWith("data");
  });

  it("marks the current page, and only that page", () => {
    setup({ page: "review" });
    expect(current()).toEqual(["Review"]);
    expect(screen.getByRole("button", { name: "Review" }).className).toBe(
      "active",
    );
  });

  it("marks Settings when it is open", () => {
    setup({ page: "data" });
    expect(current()).toEqual(["⚙"]);
    expect(
      screen.getByRole("button", { name: "Settings" }).className,
    ).toContain("active");
  });

  it("keeps Tests highlighted while a test is being taken", () => {
    setup({ page: "practice", testOpen: true });
    expect(current()).toEqual(["Tests"]);
  });

  it("highlights nothing for ordinary practice, which has its own screen", () => {
    setup({ page: "practice", testOpen: false });
    expect(current()).toEqual([]);
  });

  it("does not light Tests from other pages just because a test exists", () => {
    setup({ page: "home", testOpen: true });
    expect(current()).toEqual(["Practice"]);
  });
});
