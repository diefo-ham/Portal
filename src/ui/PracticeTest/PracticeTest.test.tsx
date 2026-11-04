// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type Session, type StudyData } from "../../core/model";
import { beginPracticeTest } from "../../core/practiceTest";
import { testCorpus } from "../../../tests/practiceTestFixtures";
import { PracticeTestSetup } from "./PracticeTest";

afterEach(cleanup);

/** One finished Full Test and one Math module still in progress. */
const library = () => {
  const data = testCorpus();
  const done = beginPracticeTest(data, "full", "timed");
  done.finishedAt = "2026-03-01T10:00:00.000Z";
  done.practiceTest!.phase = "results";
  const active = beginPracticeTest(data, "math:first", "untimed");
  return { data, done, active };
};

/** Applies the change to `data` in place, like the real store does on save. */
const store = (data: StudyData) =>
  vi.fn(async (fn: (draft: StudyData) => void) => {
    fn(data);
    return data;
  });

const setup = (data: StudyData, mutate = store(data)) => {
  const onOpen = vi.fn();
  const onSettings = vi.fn();
  const user = userEvent.setup();
  render(
    <PracticeTestSetup
      data={data}
      mutate={mutate}
      onOpen={onOpen}
      onSettings={onSettings}
    />,
  );
  return { user, mutate, onOpen, onSettings };
};

const actionsFor = (session: Session) =>
  screen.getByRole("button", {
    name: `Practice Test actions for ${session.name!}`,
  });

describe("PracticeTestSetup", () => {
  it("introduces the page and shows the options and the explanation", () => {
    setup(testCorpus());
    expect(
      screen.getByRole("heading", { name: "A test, at your pace." }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Test selection")).toBeTruthy();
    expect(screen.getByText("How Practice Tests work")).toBeTruthy();
  });

  it("has no list of tests before any is started", () => {
    setup(testCorpus());
    expect(screen.queryByText("Your Practice Tests")).toBeNull();
  });

  it("lists tests, newest first, with the right action for each", () => {
    const { data, done, active } = library();
    setup(data);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(active.name!)).toBeTruthy();
    expect(within(rows[0]).getByText(/untimed$/)).toBeTruthy();
    expect(
      within(rows[0]).getByRole("button", { name: "Resume test" }),
    ).toBeTruthy();
    expect(within(rows[1]).getByText(done.name!)).toBeTruthy();
    expect(within(rows[1]).getByText(/timed$/)).toBeTruthy();
    expect(
      within(rows[1]).getByRole("button", { name: "View results" }),
    ).toBeTruthy();
  });

  it("opens a test from its row", async () => {
    const { data, done } = library();
    const { user, onOpen } = setup(data);
    await user.click(screen.getByRole("button", { name: "View results" }));
    expect(onOpen).toHaveBeenCalledWith(done.id);
  });

  describe("starting", () => {
    it("begins the chosen test and opens it", async () => {
      const data = testCorpus();
      const { user, mutate, onOpen } = setup(data);
      await user.selectOptions(
        screen.getByLabelText("Test selection"),
        "math:first",
      );
      await user.selectOptions(screen.getByLabelText("Timing"), "untimed");
      await user.click(
        screen.getByRole("button", { name: "Start Practice Test" }),
      );
      await waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).toHaveLength(1);
      const started = data.sessions[0];
      expect(onOpen).toHaveBeenCalledWith(started.id);
      expect(started.practiceTest!.selection).toBe("math:first");
      expect(started.practiceTest!.timing).toBe("untimed");
    });

    it("explains when there are not enough questions and offers Settings", async () => {
      const { user, onSettings } = setup(emptyData());
      expect(screen.getByRole("status").textContent).toContain(
        "unused active questions",
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Start Practice Test",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      await user.click(
        screen.getByRole("button", { name: "Open reset settings" }),
      );
      expect(onSettings).toHaveBeenCalledOnce();
    });

    it("stays on the page when saving fails", async () => {
      const data = testCorpus();
      const mutate = vi.fn().mockRejectedValue(new Error("disk full"));
      const { user, onOpen } = setup(data, mutate);
      await user.click(
        screen.getByRole("button", { name: "Start Practice Test" }),
      );
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      expect(onOpen).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          (
            screen.getByRole("button", {
              name: "Start Practice Test",
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
    });
  });

  describe("renaming", () => {
    it("offers the current name and saves a new one", async () => {
      const { data, active } = library();
      const { user, mutate } = setup(data);
      await user.click(actionsFor(active));
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));
      const dialog = screen.getByRole("dialog", {
        name: "Rename Practice Test",
      });
      const input = within(dialog).getByLabelText(
        "Test name",
      ) as HTMLInputElement;
      expect(input.value).toBe(active.name!);
      await user.clear(input);
      await user.type(input, "Saturday mock{Enter}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(active.name!).toBe("Saturday mock");
      expect(screen.getByText("Saturday mock")).toBeTruthy();
    });

    it("closes without changing anything when cancelled", async () => {
      const { data, active } = library();
      const before = active.name!;
      const { user, mutate } = setup(data);
      await user.click(actionsFor(active));
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(active.name!).toBe(before);
    });
  });

  describe("cancelling a test in progress", () => {
    it("offers Cancel test, not Delete test, for an unfinished test", async () => {
      const { data, active } = library();
      const { user } = setup(data);
      await user.click(actionsFor(active));
      expect(
        screen.getByRole("menuitem", { name: "Cancel test" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("menuitem", { name: "Delete test" }),
      ).toBeNull();
    });

    it("keeps the test when the person changes their mind", async () => {
      const { data, active } = library();
      const { user, mutate } = setup(data);
      await user.click(actionsFor(active));
      await user.click(screen.getByRole("menuitem", { name: "Cancel test" }));
      expect(
        screen.getByRole("dialog", { name: "Abandon this Practice Test?" }),
      ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Keep test" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(data.sessions).toContain(active);
    });

    it("removes the test when confirmed", async () => {
      const { data, active } = library();
      const { user, mutate } = setup(data);
      await user.click(actionsFor(active));
      await user.click(screen.getByRole("menuitem", { name: "Cancel test" }));
      await user.click(
        screen.getByRole("button", { name: "Cancel Practice Test" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).not.toContain(active);
      expect(screen.queryByText(active.name!)).toBeNull();
    });

    it("disables the confirm button while saving", async () => {
      const { data, active } = library();
      let finish!: () => void;
      const mutate = vi.fn(
        (fn: (draft: StudyData) => void) =>
          new Promise<StudyData>((resolve) => {
            finish = () => {
              fn(data);
              resolve(data);
            };
          }),
      );
      const { user } = setup(data, mutate);
      await user.click(actionsFor(active));
      await user.click(screen.getByRole("menuitem", { name: "Cancel test" }));
      const confirm = screen.getByRole("button", {
        name: "Cancel Practice Test",
      }) as HTMLButtonElement;
      await user.click(confirm);
      expect(confirm.disabled).toBe(true);
      finish();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  });

  describe("deleting a finished test", () => {
    it("offers Delete test, not Cancel test, for a finished test", async () => {
      const { data, done } = library();
      const { user } = setup(data);
      await user.click(actionsFor(done));
      expect(
        screen.getByRole("menuitem", { name: "Delete test" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("menuitem", { name: "Cancel test" }),
      ).toBeNull();
    });

    it("names the test and says what stays", async () => {
      const { data, done } = library();
      const { user } = setup(data);
      await user.click(actionsFor(done));
      await user.click(screen.getByRole("menuitem", { name: "Delete test" }));
      const dialog = screen.getByRole("dialog", {
        name: "Delete this completed test?",
      });
      expect(dialog.textContent).toContain(`“${done.name!}”`);
      expect(dialog.textContent).toContain("Bookmarks, settings");
    });

    it("removes the test when confirmed", async () => {
      const { data, done } = library();
      const { user, mutate } = setup(data);
      await user.click(actionsFor(done));
      await user.click(screen.getByRole("menuitem", { name: "Delete test" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Delete test",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).not.toContain(done);
    });
  });
});
