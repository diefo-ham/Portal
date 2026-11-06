// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Assessment } from "../core/model";
import type { PrepareReport } from "../importing/pdf/prepare";
import { AddPdfsDialog, type PrepareFiles } from "./AddPdfsDialog";
import { AssessmentProvider, translator } from "./i18n";

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

const pdf = (name: string) =>
  new File(["%PDF"], name, { type: "application/pdf" });

const SAT_NAMES = [
  "read_write_inactive.pdf",
  "read_write_active.pdf",
  "math_inactive.pdf",
  "math_active.pdf",
];

const prepared = (questions: number): ReturnType<PrepareFiles> =>
  Promise.resolve({
    report: {
      importedQuestions: questions,
      quarantined: [],
      conflicts: [],
      interpretation: {},
      ignored: [],
      counts: { section: {}, testStatus: {}, difficulty: {} },
    } as unknown as PrepareReport,
    result: { unchanged: false },
  });

const setup = (assessment: Assessment) => {
  const prepareSat = vi.fn<PrepareFiles>(() => prepared(8));
  const preparePaa = vi.fn<PrepareFiles>(() => prepared(5));
  const t = translator(assessment);
  render(
    <AssessmentProvider value={assessment}>
      <AddPdfsDialog
        open
        onClose={vi.fn()}
        prepareSat={prepareSat}
        preparePaa={preparePaa}
      />
    </AssessmentProvider>,
  );
  return { prepareSat, preparePaa, t, user: userEvent.setup() };
};

const names = (call: unknown[] | undefined) =>
  (call?.[0] as File[]).map((file) => file.name).sort();

describe.each<Assessment>(["SAT", "PAA"])(
  "adding all five PDFs at once, from the %s portal",
  (assessment) => {
    it("reads the four SAT exports as SAT and the rest as PAA", async () => {
      const { prepareSat, preparePaa, t, user } = setup(assessment);
      await user.upload(screen.getByLabelText(t("PDF export files")), [
        ...SAT_NAMES.map(pdf),
        pdf("banco-paa.pdf"),
      ]);
      await user.click(
        screen.getByRole("button", { name: t("Add questions") }),
      );

      await waitFor(() => expect(preparePaa).toHaveBeenCalledTimes(1));
      expect(prepareSat).toHaveBeenCalledTimes(1);
      expect(names(prepareSat.mock.calls[0])).toEqual([...SAT_NAMES].sort());
      expect(names(preparePaa.mock.calls[0])).toEqual(["banco-paa.pdf"]);

      // Each report says which test it is for, and the other test's is pointed out.
      expect(await screen.findByRole("heading", { name: "SAT" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "PAA" })).toBeTruthy();
      const other = assessment === "SAT" ? "PAA" : "SAT";
      expect(
        screen.getAllByText(
          t(
            "These are {test} questions. Use the switch at the top to open them.",
            { test: other },
          ),
        ),
      ).toHaveLength(1);
    });

    it("adds only the PAA export when the SAT set is not there", async () => {
      const { prepareSat, preparePaa, t, user } = setup(assessment);
      await user.upload(screen.getByLabelText(t("PDF export files")), [
        pdf("banco-paa.pdf"),
      ]);
      await user.click(
        screen.getByRole("button", { name: t("Add questions") }),
      );
      await waitFor(() => expect(preparePaa).toHaveBeenCalledTimes(1));
      expect(prepareSat).not.toHaveBeenCalled();
    });
  },
);

describe("adding TSI exports", () => {
  const setupTsi = (kinds: Record<string, "PAA" | "TSI" | undefined>) => {
    const prepareSat = vi.fn<PrepareFiles>(() => prepared(8));
    const preparePaa = vi.fn<PrepareFiles>(() => prepared(5));
    const prepareTsi = vi.fn<PrepareFiles>(() => prepared(170));
    const detect = vi.fn(async (file: File) => kinds[file.name]);
    render(
      <AssessmentProvider value="TSI">
        <AddPdfsDialog
          open
          onClose={vi.fn()}
          prepareSat={prepareSat}
          preparePaa={preparePaa}
          prepareTsi={prepareTsi}
          detect={detect}
        />
      </AssessmentProvider>,
    );
    return {
      prepareSat,
      preparePaa,
      prepareTsi,
      detect,
      user: userEvent.setup(),
    };
  };

  it("sorts PDFs by the test named inside them, not by file name", async () => {
    const { prepareSat, preparePaa, prepareTsi, detect, user } = setupTsi({
      "ELAR.pdf": "TSI",
      "Math.pdf": "TSI",
      "banco-paa.pdf": "PAA",
      "carta.pdf": undefined,
    });
    await user.upload(screen.getByLabelText("PDF export files"), [
      ...SAT_NAMES.map(pdf),
      pdf("ELAR.pdf"),
      pdf("Math.pdf"),
      pdf("banco-paa.pdf"),
      pdf("carta.pdf"),
    ]);
    // The four SAT exports are recognised by name and never opened.
    expect(detect).toHaveBeenCalledTimes(4);
    expect(await screen.findAllByText("TSI export")).toHaveLength(2);
    expect(screen.getByText("PAA export")).toBeTruthy();
    expect(
      screen.getByText(
        "Not a PAA or TSI question export: it will be set aside",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add questions" }));
    await waitFor(() => expect(prepareTsi).toHaveBeenCalledTimes(1));
    expect(names(prepareTsi.mock.calls[0])).toEqual(["ELAR.pdf", "Math.pdf"]);
    expect(names(preparePaa.mock.calls[0])).toEqual([
      "banco-paa.pdf",
      "carta.pdf",
    ]);
    expect(names(prepareSat.mock.calls[0])).toEqual([...SAT_NAMES].sort());
    expect(await screen.findByRole("heading", { name: "TSI" })).toBeTruthy();
  });

  it("waits for the check before it lets the PDFs be added", async () => {
    let release: (kind: "TSI") => void = () => {};
    const prepareTsi = vi.fn<PrepareFiles>(() => prepared(90));
    const detect = vi.fn(
      () => new Promise<"TSI">((resolve) => (release = resolve)),
    );
    render(
      <AssessmentProvider value="TSI">
        <AddPdfsDialog
          open
          onClose={vi.fn()}
          prepareSat={vi.fn<PrepareFiles>(() => prepared(0))}
          preparePaa={vi.fn<PrepareFiles>(() => prepared(0))}
          prepareTsi={prepareTsi}
          detect={detect}
        />
      </AssessmentProvider>,
    );
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("PDF export files"), [
      pdf("ELAR.pdf"),
    ]);
    expect(screen.getByText("Checking…")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Add questions",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    release("TSI");
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Add questions",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  });
});
