// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PracticeTestOptions,
  describeTest,
  type PracticeTestOptionsProps,
} from "./PracticeTestOptions";

afterEach(cleanup);

const setup = (overrides: Partial<PracticeTestOptionsProps> = {}) => {
  const props: PracticeTestOptionsProps = {
    selection: "full",
    timing: "timed",
    busy: false,
    onSelection: vi.fn(),
    onTiming: vi.fn(),
    onStart: vi.fn(),
    onSettings: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<PracticeTestOptions {...props} />);
  return { props, user };
};

describe("describeTest", () => {
  it("describes a timed Full Test", () => {
    expect(describeTest("full", "timed")).toBe(
      "98 questions · four modules · optional 10-minute break. 32 minutes per Reading and Writing module; 35 minutes per Math module. Leaving an active module pauses its clock until you explicitly resume.",
    );
  });

  it("counts 27 questions for a Reading and Writing module and 22 for Math", () => {
    expect(describeTest("reading-writing:first", "timed")).toContain(
      "27 questions · one module.",
    );
    expect(describeTest("math:higher", "timed")).toContain(
      "22 questions · one module.",
    );
  });

  it("says there is no deadline when untimed", () => {
    const text = describeTest("math:first", "untimed");
    expect(text).toContain(
      "Elapsed time only. No deadline or automatic module end.",
    );
    expect(text).not.toContain("32 minutes");
  });
});

describe("PracticeTestOptions", () => {
  it("offers every selection, starting at the chosen one", () => {
    setup({ selection: "math:lower" });
    const select = screen.getByLabelText("Test selection") as HTMLSelectElement;
    expect(select.value).toBe("math:lower");
    expect(select.options.length).toBe(7);
    expect(select.options[0].textContent).toBe("Full Test");
  });

  it("reports a new selection", async () => {
    const { props, user } = setup();
    await user.selectOptions(
      screen.getByLabelText("Test selection"),
      "math:first",
    );
    expect(props.onSelection).toHaveBeenCalledWith("math:first");
  });

  it("offers Timed and Untimed and reports the change", async () => {
    const { props, user } = setup();
    const timing = screen.getByLabelText("Timing") as HTMLSelectElement;
    expect(timing.value).toBe("timed");
    await user.selectOptions(timing, "untimed");
    expect(props.onTiming).toHaveBeenCalledWith("untimed");
  });

  it("shows the description of the current choices", () => {
    setup({ selection: "math:first", timing: "untimed" });
    expect(
      screen.getByText(describeTest("math:first", "untimed")),
    ).toBeTruthy();
  });

  it("starts the test", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Start Practice Test" }),
    );
    expect(props.onStart).toHaveBeenCalledOnce();
  });

  it("has no warning and an enabled start button when the test is available", () => {
    setup();
    expect(screen.queryByRole("status")).toBeNull();
    const start = screen.getByRole("button", {
      name: "Start Practice Test",
    }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
  });

  it("explains why a test cannot start and links to the reset settings", async () => {
    const { props, user } = setup({ error: "Math needs 44 unused questions." });
    expect(screen.getByRole("status").textContent).toContain(
      "Math needs 44 unused questions.",
    );
    const start = screen.getByRole("button", {
      name: "Start Practice Test",
    }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Open reset settings" }),
    );
    expect(props.onSettings).toHaveBeenCalledOnce();
  });

  it("disables starting while busy", () => {
    setup({ busy: true });
    const start = screen.getByRole("button", {
      name: "Start Practice Test",
    }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });
});
