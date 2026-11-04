// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type StudyData } from "../../core/model";
import { AssessmentProvider, translator } from "../i18n";
import { testCorpus } from "../../../tests/practiceTestFixtures";
import {
  MaintenanceSection,
  type MaintenanceSectionProps,
} from "./MaintenanceSection";

// jsdom has no modal <dialog>: opening one just marks it open.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

const setup = (
  overrides: Partial<MaintenanceSectionProps> = {},
  assessment: "SAT" | "PAA" = "SAT",
) => {
  const props: MaintenanceSectionProps = {
    data: testCorpus(2),
    busy: false,
    onAddPdfs: vi.fn(),
    onRemovePdf: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue(undefined),
    onReset: vi.fn().mockResolvedValue(undefined),
    onRemoveQuestions: vi.fn().mockResolvedValue(undefined),
    onEraseEverything: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <AssessmentProvider value={assessment}>
      <MaintenanceSection {...props} />
    </AssessmentProvider>,
  );
  return { props, user };
};

describe("MaintenanceSection", () => {
  it("is a labelled section", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Your questions" }),
    ).toBeTruthy();
    expect(
      document.querySelector('[aria-labelledby="maintenance-heading"]'),
    ).toBeTruthy();
  });

  it("says how many questions are stored", () => {
    setup({ data: testCorpus(3) });
    expect(
      screen.getByText(
        /6 questions are stored in this browser, with your answers\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Nothing is uploaded, and no account is needed\./),
    ).toBeTruthy();
  });

  it("invites adding PDFs when there are no questions", () => {
    setup({ data: emptyData() });
    expect(
      screen.getByText(/No questions yet\. Add your PDFs below\./),
    ).toBeTruthy();
  });

  it("counts questions, attempts and bookmarks on this device", () => {
    const data: StudyData = testCorpus(2);
    data.annotations["math-0"] = {
      bookmarked: true,
    } as StudyData["annotations"][string];
    data.annotations["math-1"] = {
      bookmarked: false,
    } as StudyData["annotations"][string];
    data.attempts = [
      { id: "a1", questionId: "math-0" },
      { id: "a2", questionId: "math-1" },
    ] as unknown as StudyData["attempts"];
    setup({ data });
    expect(
      screen.getByText("4 questions · 2 attempts · 1 bookmarks"),
    ).toBeTruthy();
  });

  it("explains where the data lives, naming this site", () => {
    setup();
    expect(
      screen.getByText(
        new RegExp(`clearing its site data for ${location.origin}`),
      ),
    ).toBeTruthy();
  });

  it("opens the PDF dialog from Add PDFs", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "Add PDFs" }));
    expect(props.onAddPdfs).toHaveBeenCalledOnce();
  });

  it("resets progress with the bookmark choice after confirming", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Reset study progress" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Reset study progress?",
    });
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Also clear bookmarks" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm reset" }),
    );
    expect(props.onReset).toHaveBeenCalledWith(true);
    expect(props.onRestore).not.toHaveBeenCalled();
  });

  it("offers to restore only when there is an archive", async () => {
    setup();
    expect(
      screen.queryByRole("button", { name: "Restore previous study state" }),
    ).toBeNull();
    cleanup();
    const { props, user } = setup({ archiveDate: "2026-03-01T10:00:00.000Z" });
    await user.click(
      screen.getByRole("button", { name: "Restore previous study state" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Restore previous study state?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm restore" }),
    );
    expect(props.onRestore).toHaveBeenCalledOnce();
    expect(props.onReset).not.toHaveBeenCalled();
  });

  it("removes the questions after confirming", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Remove my questions" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Remove your questions?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Remove questions" }),
    );
    expect(props.onRemoveQuestions).toHaveBeenCalledOnce();
    expect(props.onEraseEverything).not.toHaveBeenCalled();
  });

  it("erases everything after confirming", async () => {
    const { props, user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Erase all data on this device" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Erase all data on this device?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Erase everything" }),
    );
    expect(props.onEraseEverything).toHaveBeenCalledOnce();
    expect(props.onRemoveQuestions).not.toHaveBeenCalled();
  });

  it("cannot remove questions that are not there", () => {
    setup({ data: emptyData() });
    const remove = screen.getByRole("button", {
      name: "Remove my questions",
    }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
  });

  it("disables the actions while busy", () => {
    setup({ busy: true });
    for (const name of [
      "Add PDFs",
      "Reset study progress",
      "Remove my questions",
      "Erase all data on this device",
    ])
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
  });

  it("is in Spanish for the PAA", () => {
    setup({}, "PAA");
    const t = translator("PAA");
    expect(
      screen.getByRole("heading", { name: t("Your questions") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: t("Stored on this device") }),
    ).toBeTruthy();
  });
});
