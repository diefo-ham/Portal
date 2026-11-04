// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { testCorpus } from "../../../tests/practiceTestFixtures";
import { SettingsPage, type SettingsPageProps } from "./SettingsPage";

afterEach(cleanup);

const setup = () => {
  const props: SettingsPageProps = {
    appearance: {
      theme: "auto",
      setTheme: vi.fn(),
      originalPdf: false,
      setOriginalPdf: vi.fn(),
    },
    preferences: {
      timerDefault: true,
      onTimerDefault: vi.fn(),
      showCorrectExplanations: false,
      onShowCorrectExplanations: vi.fn(),
      deleteRemovesAnswers: false,
      onDeleteRemovesAnswers: vi.fn(),
      offerProtection: true,
      protectedTests: true,
      onProtectedTests: vi.fn(),
    },
    maintenance: {
      data: testCorpus(2),
      busy: false,
      onAddPdfs: vi.fn(),
      onRemovePdf: vi.fn().mockResolvedValue(undefined),
      onRestore: vi.fn().mockResolvedValue(undefined),
      onReset: vi.fn().mockResolvedValue(undefined),
      onRemoveQuestions: vi.fn().mockResolvedValue(undefined),
      onEraseEverything: vi.fn().mockResolvedValue(undefined),
    },
  };
  const user = userEvent.setup();
  render(<SettingsPage {...props} />);
  return { props, user };
};

describe("SettingsPage", () => {
  it("is the page's main landmark, titled Settings", () => {
    setup();
    const main = screen.getByRole("main");
    expect(main.className).toBe("page narrow settings-page");
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeTruthy();
  });

  it("shows appearance, study preferences and your questions, in that order", () => {
    setup();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    const at = (text: string) => headings.indexOf(text);
    expect(at("Appearance")).toBe(0);
    expect(at("Study preferences")).toBeGreaterThan(at("Appearance"));
    expect(at("Your questions")).toBeGreaterThan(at("Study preferences"));
  });

  it("passes preference changes through", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getByRole("checkbox", { name: "Timer on by default" }),
    );
    expect(props.preferences.onTimerDefault).toHaveBeenCalledWith(false);
  });

  it("passes appearance changes through", async () => {
    const { props, user } = setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Theme" }),
      "dark",
    );
    expect(props.appearance.setTheme).toHaveBeenCalledWith("dark");
    await user.click(
      screen.getByRole("checkbox", { name: "Keep original PDF colors" }),
    );
    expect(props.appearance.setOriginalPdf).toHaveBeenCalledWith(true);
  });

  it("passes maintenance actions through", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Add PDFs" }));
    expect(props.maintenance.onAddPdfs).toHaveBeenCalledOnce();
  });
});
