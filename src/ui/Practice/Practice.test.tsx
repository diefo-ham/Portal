// @vitest-environment jsdom
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beginSession } from "../../core/commands";
import { defaultFilters, emptyData, type StudyData } from "../../core/model";
import {
  choiceQuestion,
  numericQuestion,
} from "../../../tests/questionFixtures";
import { Practice, type PracticeProps } from "./Practice";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
beforeEach(() => {
  window.scrollTo = vi.fn() as typeof window.scrollTo;
});
afterEach(cleanup);

/** Two reading questions and a numeric math one, in a fresh session. */
const library = (timerVisible = false) => {
  const data = emptyData();
  data.questions.push(
    choiceQuestion({
      id: "q1",
      section: "reading-writing",
      stem: "First question?",
    }),
    choiceQuestion({
      id: "q2",
      section: "reading-writing",
      stem: "Second question?",
    }),
    numericQuestion({ id: "q3", stem: "Third question?" }),
  );
  const session = beginSession(
    data,
    ["q1", "q2", "q3"],
    defaultFilters,
    "Morning",
    timerVisible,
  );
  return { data, session };
};

const setup = (
  { data, session } = library(),
  overrides: Partial<PracticeProps> = {},
) => {
  const mutate = vi.fn(async (fn: (d: StudyData) => void) => {
    fn(data);
    return data;
  });
  const props: PracticeProps = {
    data,
    session,
    mutate,
    showCorrectExplanations: false,
    onBack: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  const view = render(<Practice {...props} />);
  const refresh = () => view.rerender(<Practice {...props} />);
  return { data, session, props, user, refresh };
};

const stem = () => screen.getByRole("heading", { level: 1 }).textContent;
const card = () => screen.getByRole("article");

/** Three TSI Math questions as a practice test: in order, no going back, no feedback. */
const tsiTest = () => {
  const data = emptyData();
  data.questions.push(
    ...["a", "b", "c"].map((letter) =>
      choiceQuestion({
        id: `tsi-${letter}`,
        assessment: "TSI",
        section: "tsi-math",
        stem: `Question ${letter}?`,
        testStatus: "unknown",
      }),
    ),
  );
  const session = beginSession(
    data,
    ["tsi-a", "tsi-b", "tsi-c"],
    defaultFilters,
    "Mathematics College Readiness test",
    false,
  );
  session.tsiTest = { version: 1, kind: "crc", subject: "math" };
  return { data, session };
};

describe("Practice", () => {
  it("opens on the session's current question", () => {
    setup();
    expect(stem()).toBe("First question?");
    expect(
      screen.getByRole("button", { name: "Open question overview" })
        .textContent,
    ).toBe("Question 1 of 3");
    expect(card().getAttribute("aria-label")).toBe("Question 1");
  });

  it("saves a chosen answer as a draft, then checks it", async () => {
    const { user, session, data } = setup();
    const check = screen.getByRole("button", {
      name: "Check answer",
    }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    await user.click(screen.getByRole("radio", { name: /^BFour/ }));
    expect(session.drafts.q1).toBe("B");
    await user.click(check);
    await screen.findByRole("heading", { name: "Correct. Nicely done." });
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0]).toMatchObject({ questionId: "q1", correct: true });
  });

  it("explains a wrong answer and moves on from Next", async () => {
    const { user, session } = setup();
    await user.click(screen.getByRole("radio", { name: /^AThree/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await screen.findByRole("heading", {
      name: "Not quite. Let’s work through it.",
    });
    expect(screen.getByText("Two and two make four.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next question →" }));
    await waitFor(() => expect(stem()).toBe("Second question?"));
    expect(session.index).toBe(1);
  });

  it("skips and comes back", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Skip for now →" }));
    await waitFor(() => expect(stem()).toBe("Second question?"));
    await user.click(screen.getByRole("button", { name: "← Previous" }));
    await waitFor(() => expect(stem()).toBe("First question?"));
  });

  it("checks a typed number", async () => {
    const { data, session } = library();
    session.index = 2;
    const { user } = setup({ data, session });
    await user.type(
      screen.getByRole("textbox", { name: "Your numeric answer" }),
      "1/2{Enter}",
    );
    await screen.findByRole("heading", { name: "Correct. Nicely done." });
  });

  it("finishes from the last question", async () => {
    const { data, session } = library();
    session.index = 2;
    const { user } = setup({ data, session });
    await user.click(screen.getByRole("button", { name: "Review session →" }));
    await waitFor(() => expect(session.finishedAt).toBeTruthy());
  });

  it("bookmarks the question", async () => {
    const { user, data } = setup();
    await user.click(screen.getByRole("button", { name: "Bookmark question" }));
    await waitFor(() => expect(data.annotations.q1?.bookmarked).toBe(true));
    expect(
      screen.getByRole("button", { name: "Remove bookmark" }),
    ).toBeTruthy();
  });

  it("exits after saving the timer", async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole("button", { name: "← Exit" }));
    await waitFor(() => expect(props.onBack).toHaveBeenCalledOnce());
  });

  describe("keyboard", () => {
    const press = (key: string) => fireEvent.keyDown(card(), { key });

    it("chooses with a letter or number, and the same key clears it", async () => {
      const { session } = setup();
      press("c");
      await waitFor(() => expect(session.drafts.q1).toBe("C"));
      press("3");
      await waitFor(() => expect(session.drafts.q1).toBe(""));
      press("2");
      await waitFor(() => expect(session.drafts.q1).toBe("B"));
    });

    it("checks with Enter, then moves on with Enter", async () => {
      const { session } = setup();
      press("b");
      press("Enter");
      await screen.findByRole("heading", { name: "Correct. Nicely done." });
      press("Enter");
      await waitFor(() => expect(session.index).toBe(1));
    });

    it("moves with the arrows", async () => {
      const { session } = setup();
      press("ArrowRight");
      await waitFor(() => expect(session.index).toBe(1));
      press("ArrowLeft");
      await waitFor(() => expect(session.index).toBe(0));
    });

    it("bookmarks with E", async () => {
      const { data } = setup();
      press("e");
      await waitFor(() => expect(data.annotations.q1?.bookmarked).toBe(true));
    });

    it("asks before leaving on Escape, and leaves", async () => {
      const { user, props } = setup();
      press("Escape");
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByRole("heading", { name: "Leave this session?" }),
      ).toBeTruthy();
      await user.click(
        within(dialog).getByRole("button", { name: "Leave session" }),
      );
      await waitFor(() => expect(props.onBack).toHaveBeenCalledOnce());
    });

    it("ignores shortcuts while a panel is open", async () => {
      const { session } = setup();
      press("Escape");
      await screen.findByRole("dialog");
      press("b");
      expect(session.drafts.q1).toBeUndefined();
    });
  });

  describe("tools", () => {
    it("opens from ••• with the tools", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Practice tools" }));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("heading", { name: "Practice tools" }),
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("checkbox", { name: "Show timer" }),
      ).toBeTruthy();
    });

    it("opens details from the tools, and goes back", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Practice tools" }));
      await user.click(
        screen.getByRole("button", { name: "Question details" }),
      );
      expect(
        screen.getByRole("heading", { name: "Question details" }),
      ).toBeTruthy();
      expect(screen.getByText("Difficulty: medium")).toBeTruthy();
      await user.click(
        screen.getByRole("button", { name: "Back to Practice tools" }),
      );
      expect(
        screen.getByRole("heading", { name: "Practice tools" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Back to Practice tools" }),
      ).toBeNull();
    });

    it("shows the timer when asked", async () => {
      const { user, session, refresh } = setup();
      expect(screen.queryByLabelText("Time on this question")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Practice tools" }));
      await user.click(screen.getByRole("checkbox", { name: "Show timer" }));
      await waitFor(() => expect(session.timerVisible).toBe(true));
      refresh();
      expect(screen.getByLabelText("Time on this question")).toBeTruthy();
    });

    it("pauses the timer and blocks answering", async () => {
      const { user, session } = setup();
      await user.click(screen.getByRole("button", { name: "Practice tools" }));
      await user.click(screen.getByRole("button", { name: "Pause timer" }));
      await waitFor(() => expect(session.paused).toBe(true));
      expect(
        (
          screen.getByRole("group", {
            name: "Your answer",
          }) as HTMLFieldSetElement
        ).disabled,
      ).toBe(true);
    });

    it("finishes the session from the tools", async () => {
      const { user, session } = setup();
      await user.click(screen.getByRole("button", { name: "Practice tools" }));
      await user.click(screen.getByRole("button", { name: "Finish session" }));
      await waitFor(() => expect(session.finishedAt).toBeTruthy());
    });
  });

  describe("overview", () => {
    it("opens from the question count and jumps to a question", async () => {
      const { user, session } = setup();
      await user.click(
        screen.getByRole("button", { name: "Open question overview" }),
      );
      expect(screen.getByRole("heading", { name: "Session map" })).toBeTruthy();
      await user.click(
        screen.getByRole("button", { name: "Go to question 3" }),
      );
      await waitFor(() => expect(session.index).toBe(2));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("offers the calculator only for Math questions", async () => {
    setup();
    expect(screen.queryByRole("button", { name: "Calculator" })).toBeNull();
    cleanup();
    const { data, session } = library();
    session.index = 2;
    setup({ data, session });
    expect(
      screen
        .getByRole("button", { name: "Calculator" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("shows the results once the session is finished", () => {
    const { data, session } = library();
    session.finishedAt = new Date().toISOString();
    setup({ data, session });
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
    expect(
      document.querySelector(".completed-calculator-context"),
    ).toBeTruthy();
  });
});

describe("a TSI practice test", () => {
  it("has no way back: no Previous, no overview, no Skip", () => {
    setup(tsiTest());
    expect(screen.queryByRole("button", { name: /Previous/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open question overview" }),
    ).toBeNull();
    expect(screen.getByText("Question 1")).toBeTruthy();
  });

  it("records the answer and moves on, showing no feedback", async () => {
    const { user, session, data } = setup(tsiTest());
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /^AThree/ }));
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(data.attempts).toHaveLength(1));
    expect(data.attempts[0]).toMatchObject({
      questionId: "tsi-a",
      correct: false,
    });
    expect(session.index).toBe(1);
    // Nothing said whether it was right.
    expect(
      screen.queryByText(/Not quite|Correct\. Nicely done|Two and two/),
    ).toBeNull();
  });

  it("does not move back with the left arrow", async () => {
    const { user, session } = setup(tsiTest());
    await user.click(screen.getByRole("radio", { name: /^BFour/ }));
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(session.index).toBe(1));
    fireEvent.keyDown(screen.getByRole("main"), { key: "ArrowLeft" });
    expect(session.index).toBe(1);
  });

  it("finishes after the last answer and shows percent and domains, with no score", async () => {
    const { user, session, data, refresh } = setup(tsiTest());
    for (const [choice, name] of [
      ["B", "Next question"],
      ["B", "Next question"],
      ["A", "Finish test"],
    ] as const) {
      await user.click(
        screen.getByRole("radio", { name: new RegExp(`^${choice}`) }),
      );
      await user.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(data.attempts.length).toBeGreaterThan(0));
      refresh();
    }
    await waitFor(() => expect(session.finishedAt).toBeDefined());
    refresh();
    expect(
      await screen.findByRole("heading", { name: "2 of 3 correct." }),
    ).toBeTruthy();
    expect(screen.getByText(/67% correct/)).toBeTruthy();
    expect(screen.getByText(/not a TSIA2 score/)).toBeTruthy();
    expect(screen.getByText("← Back to tests")).toBeTruthy();
  });

  it("offers Finish test now instead of a session overview in the tools", async () => {
    const { user } = setup(tsiTest());
    await user.click(screen.getByRole("button", { name: "Practice tools" }));
    expect(
      screen.getByRole("button", { name: "Finish test now" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Question overview" }),
    ).toBeNull();
  });
});
