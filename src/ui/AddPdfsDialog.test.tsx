// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Assessment } from "../core/model";
import type { PrepareReport } from "../importing/pdf/prepare";
import { AddPdfsDialog, type Kind, type PrepareFiles } from "./AddPdfsDialog";
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

const prepared = (
  questions: number,
  extra: Partial<PrepareReport> = {},
): ReturnType<PrepareFiles> =>
  Promise.resolve({
    report: {
      importedQuestions: questions,
      quarantined: [],
      ignored: [],
      counts: { section: {}, testStatus: {}, difficulty: {} },
      ...extra,
    } as unknown as PrepareReport,
    result: { unchanged: false },
  });

const setup = (
  assessment: Assessment,
  kinds: Record<string, Kind | undefined>,
) => {
  const prepareSat = vi.fn<PrepareFiles>(() => prepared(120));
  const preparePaa = vi.fn<PrepareFiles>(() => prepared(60));
  const prepareTsi = vi.fn<PrepareFiles>(() => prepared(90));
  const detect = vi.fn(async (file: File) => kinds[file.name]);
  const t = translator(assessment);
  render(
    <AssessmentProvider value={assessment}>
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
    t,
    user: userEvent.setup(),
  };
};

const names = (call: unknown[] | undefined) =>
  (call?.[0] as File[]).map((file) => file.name).sort();

describe.each<Assessment>(["SAT", "PAA", "TSI"])(
  "adding the three PDFs from the %s portal",
  (assessment) => {
    it("sorts each PDF by the test named inside it, whatever its file name", async () => {
      const { prepareSat, preparePaa, prepareTsi, detect, t, user } = setup(
        assessment,
        {
          "uno.pdf": "SAT",
          "dos.pdf": "PAA",
          "tres.pdf": "TSI",
          "carta.pdf": undefined,
        },
      );
      await user.upload(screen.getByLabelText(t("PDF export files")), [
        pdf("uno.pdf"),
        pdf("dos.pdf"),
        pdf("tres.pdf"),
        pdf("carta.pdf"),
      ]);
      // Every PDF is looked at, and none is read by its name.
      await waitFor(() => expect(detect).toHaveBeenCalledTimes(4));
      // The test is not named beside the files; only the one that is no question PDF is flagged.
      expect(
        await screen.findByText(t("Not a question PDF: it will be set aside")),
      ).toBeTruthy();
      for (const label of ["SAT questions", "PAA questions", "TSI questions"])
        expect(screen.queryByText(label)).toBeNull();
      expect(screen.queryByText(/Advanced|Reviewed exceptions/)).toBeNull();
      await user.click(
        screen.getByRole("button", { name: t("Add questions") }),
      );
      await waitFor(() => expect(prepareTsi).toHaveBeenCalledTimes(1));
      expect(names(prepareSat.mock.calls[0])).toEqual(["uno.pdf"]);
      expect(names(preparePaa.mock.calls[0])).toEqual(["dos.pdf"]);
      expect(names(prepareTsi.mock.calls[0])).toEqual(["tres.pdf"]);

      // Each report says which test it is for, and the other tests' are pointed out.
      for (const kind of ["SAT", "PAA", "TSI"] as const)
        expect(await screen.findByRole("heading", { name: kind })).toBeTruthy();
      expect(
        screen.queryAllByText(
          t(
            "These are {test} questions. Use the switch at the top to open them.",
            { test: "SAT" },
          ),
        ),
      ).toHaveLength(assessment === "SAT" ? 0 : 1);
    });

    it("adds only the test that was dropped", async () => {
      const { prepareSat, preparePaa, prepareTsi, detect, t, user } = setup(
        assessment,
        { "solo.pdf": "PAA" },
      );
      await user.upload(screen.getByLabelText(t("PDF export files")), [
        pdf("solo.pdf"),
      ]);
      await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(
          (
            screen.getByRole("button", {
              name: t("Add questions"),
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
      await user.click(
        screen.getByRole("button", { name: t("Add questions") }),
      );
      await waitFor(() => expect(preparePaa).toHaveBeenCalledTimes(1));
      expect(prepareSat).not.toHaveBeenCalled();
      expect(prepareTsi).not.toHaveBeenCalled();
    });
  },
);

describe("the access code", () => {
  it("says which files were refused and why, in the report", async () => {
    const prepareSat = vi.fn<PrepareFiles>(() =>
      prepared(100, {
        refused: ["viejo.pdf"],
        quarantined: [
          {
            sourceId: "ab12cd34",
            file: "sat.pdf",
            pages: [7],
            reason: "unused",
          },
        ],
      }),
    );
    render(
      <AssessmentProvider value="SAT">
        <AddPdfsDialog
          open
          onClose={vi.fn()}
          prepareSat={prepareSat}
          preparePaa={vi.fn<PrepareFiles>(() => prepared(0))}
          prepareTsi={vi.fn<PrepareFiles>(() => prepared(0))}
          detect={async () => "SAT"}
        />
      </AssessmentProvider>,
    );
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("PDF export files"), [
      pdf("sat.pdf"),
    ]);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Add questions",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: "Add questions" }));
    expect(
      await screen.findByText(
        /Not added, because no page carries the access code: viejo\.pdf/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/1 could not be read safely/)).toBeTruthy();
  });

  it("shows a refusal from the reader as the result for that test", async () => {
    const prepareSat = vi.fn<PrepareFiles>(() =>
      Promise.reject(
        new Error("Nothing was added: no page carries the access code."),
      ),
    );
    render(
      <AssessmentProvider value="SAT">
        <AddPdfsDialog
          open
          onClose={vi.fn()}
          prepareSat={prepareSat}
          preparePaa={vi.fn<PrepareFiles>(() => prepared(0))}
          prepareTsi={vi.fn<PrepareFiles>(() => prepared(0))}
          detect={async () => "SAT"}
        />
      </AssessmentProvider>,
    );
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("PDF export files"), [
      pdf("sat.pdf"),
    ]);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Add questions",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: "Add questions" }));
    expect(
      await screen.findByText(
        "Nothing was added: no page carries the access code.",
      ),
    ).toBeTruthy();
  });
});

describe("checking each PDF", () => {
  it("looks at one PDF at a time and waits for the check before adding", async () => {
    let release: (kind: Kind) => void = () => {};
    let active = 0;
    let most = 0;
    const detect = vi.fn(async (file: File) => {
      active++;
      most = Math.max(most, active);
      const kind = await new Promise<Kind>((resolve) => {
        release = resolve;
        void file;
      });
      active--;
      return kind;
    });
    render(
      <AssessmentProvider value="TSI">
        <AddPdfsDialog
          open
          onClose={vi.fn()}
          prepareSat={vi.fn<PrepareFiles>(() => prepared(0))}
          preparePaa={vi.fn<PrepareFiles>(() => prepared(0))}
          prepareTsi={vi.fn<PrepareFiles>(() => prepared(90))}
          detect={detect}
        />
      </AssessmentProvider>,
    );
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("PDF export files"), [
      pdf("a.pdf"),
      pdf("b.pdf"),
    ]);
    const button = () =>
      screen.getByRole("button", {
        name: "Add questions",
      }) as HTMLButtonElement;
    expect(screen.getAllByText("Checking…")).toHaveLength(2);
    expect(button().disabled).toBe(true);
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
    release("TSI");
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2));
    expect(button().disabled).toBe(true);
    release("TSI");
    await waitFor(() => expect(button().disabled).toBe(false));
    expect(most).toBe(1);
  });
});
