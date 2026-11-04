// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssessmentProvider, translator } from "../i18n";
import {
  StudyPreferences,
  type StudyPreferencesProps,
} from "./StudyPreferences";

afterEach(cleanup);

const setup = (
  overrides: Partial<StudyPreferencesProps> = {},
  assessment: "SAT" | "PAA" = "SAT",
) => {
  const props: StudyPreferencesProps = {
    timerDefault: true,
    onTimerDefault: vi.fn(),
    showCorrectExplanations: false,
    onShowCorrectExplanations: vi.fn(),
    deleteRemovesAnswers: false,
    onDeleteRemovesAnswers: vi.fn(),
    offerProtection: true,
    protectedTests: true,
    onProtectedTests: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <AssessmentProvider value={assessment}>
      <StudyPreferences {...props} />
    </AssessmentProvider>,
  );
  return { props, user };
};

const box = (name: string) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("StudyPreferences", () => {
  it("has a heading and the four SAT preferences", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Study preferences" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("shows each current value", () => {
    setup({
      timerDefault: true,
      showCorrectExplanations: false,
      deleteRemovesAnswers: true,
      protectedTests: false,
    });
    expect(box("Timer on by default").checked).toBe(true);
    expect(box("Show explanations after correct answers").checked).toBe(false);
    expect(box("Deleting a session also removes its answers").checked).toBe(
      true,
    );
    expect(box("Protect unused practice-test questions").checked).toBe(false);
  });

  it("reports each change to its own handler", async () => {
    const { props, user } = setup();
    await user.click(box("Timer on by default"));
    expect(props.onTimerDefault).toHaveBeenCalledWith(false);
    await user.click(box("Show explanations after correct answers"));
    expect(props.onShowCorrectExplanations).toHaveBeenCalledWith(true);
    await user.click(box("Deleting a session also removes its answers"));
    expect(props.onDeleteRemovesAnswers).toHaveBeenCalledWith(true);
    await user.click(box("Protect unused practice-test questions"));
    expect(props.onProtectedTests).toHaveBeenCalledWith(false);
    for (const handler of [
      props.onTimerDefault,
      props.onShowCorrectExplanations,
      props.onDeleteRemovesAnswers,
      props.onProtectedTests,
    ])
      expect(handler).toHaveBeenCalledOnce();
  });

  it("explains each setting", () => {
    setup();
    expect(
      screen.getByText(/New sessions start with the timer visible/),
    ).toBeTruthy();
    expect(screen.getByText(/correct answers stay concise/)).toBeTruthy();
    expect(
      screen.getByText(/a deleted session leaves your answers/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Active questions are hidden by default/),
    ).toBeTruthy();
  });

  it("leaves out protection for a test without protected questions", () => {
    setup({ offerProtection: false }, "PAA");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(
      screen.queryByRole("checkbox", {
        name: "Protect unused practice-test questions",
      }),
    ).toBeNull();
  });

  it("is in Spanish for the PAA", () => {
    setup({ offerProtection: false }, "PAA");
    const t = translator("PAA");
    expect(
      screen.getByRole("heading", { name: t("Study preferences") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: t("Timer on by default") }),
    ).toBeTruthy();
  });
});
