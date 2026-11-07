// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  defaultFilters,
  emptyData,
  type Question,
  type StudyData,
} from "../core/model";
import { CalculatorPanel } from "../calculator/CalculatorPanel";
import { emptyCalculator } from "../calculator/model";
import { Filters } from "./Filters";
import { AssessmentProvider } from "./i18n";
import { QuestionHeading } from "./Practice/QuestionHeading";
import { MaintenanceSection } from "./App/MaintenanceSection";
import { StudyPreferences } from "./App/StudyPreferences";

afterEach(cleanup);

const question = (id: string, extra: Partial<Question> = {}): Question => ({
  id: `tsi-${id}`,
  assessment: "TSI",
  section: "tsi-math",
  domain: "Algebraic Reasoning",
  skill: "Linear equations",
  difficulty: "easy",
  origin: "original",
  stem: "A synthetic stem.",
  answer: { type: "choice", value: "A" },
  testStatus: "unknown",
  ...extra,
});
const bank = (...questions: Question[]): StudyData => ({
  ...emptyData(),
  questions,
});

describe("the Source filter", () => {
  it("is gone: filters offer no Source control, whatever the bank holds", () => {
    render(
      <AssessmentProvider value="TSI">
        <Filters
          data={bank(question("a", { origin: "official" }), question("b"))}
          value={{ ...defaultFilters, statuses: [] }}
          onChange={vi.fn()}
        />
      </AssessmentProvider>,
    );
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.queryByText(/Official and original/)).toBeNull();
  });
});

describe("beside a question in a session", () => {
  const heading = (q: Question) =>
    render(
      <AssessmentProvider value="TSI">
        <QuestionHeading
          question={q}
          isTest={false}
          marked={false}
          onToggle={vi.fn()}
        />
      </AssessmentProvider>,
    );

  it("shows the calculator tier but no Official or Original tag", () => {
    heading(question("a", { origin: "official", calculator: "sqrt" }));
    expect(screen.getByText("Square root calculator")).toBeTruthy();
    expect(screen.queryByText("Official")).toBeNull();
    expect(screen.queryByText("Original")).toBeNull();
  });

  it("shows no calculator chip for a question without one", () => {
    heading({ ...question("b"), calculator: undefined });
    expect(screen.queryByText(/calculator/)).toBeNull();
  });
});

describe("Settings", () => {
  it("offers the switch for original questions only when it is given", async () => {
    const onChange = vi.fn();
    const props = {
      timerDefault: true,
      onTimerDefault: vi.fn(),
      showCorrectExplanations: false,
      onShowCorrectExplanations: vi.fn(),
      deleteRemovesAnswers: false,
      onDeleteRemovesAnswers: vi.fn(),
      offerProtection: false,
      protectedTests: false,
      onProtectedTests: vi.fn(),
    };
    const { rerender } = render(
      <AssessmentProvider value="TSI">
        <StudyPreferences {...props} />
      </AssessmentProvider>,
    );
    expect(screen.queryByText("Include original questions")).toBeNull();
    rerender(
      <AssessmentProvider value="TSI">
        <StudyPreferences
          {...props}
          originalQuestions={{ checked: true, onChange }}
        />
      </AssessmentProvider>,
    );
    await userEvent.click(screen.getByLabelText("Include original questions"));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Include College Board sample items")).toBeNull();
  });

  it("no longer offers to remove the official items", () => {
    render(
      <AssessmentProvider value="TSI">
        <MaintenanceSection
          data={bank(question("a", { origin: "official" }), question("b"))}
          busy={false}
          onAddPdfs={vi.fn()}
          onRemovePdf={vi.fn()}
          onRestore={vi.fn()}
          onReset={vi.fn()}
          onRemoveQuestions={vi.fn()}
          onEraseEverything={vi.fn()}
        />
      </AssessmentProvider>,
    );
    expect(screen.queryByText("College Board sample items")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /official items/i }),
    ).toBeNull();
  });
});

describe("the keypad calculators", () => {
  const open = (tier: "basic" | "sqrt") => {
    render(
      <CalculatorPanel
        tier={tier}
        state={emptyCalculator()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    return userEvent.setup();
  };

  it("calculates with the keypad and has no square root on Basic", async () => {
    const user = open("basic");
    expect(
      screen.getByRole("heading", { name: "Basic calculator" }),
    ).toBeTruthy();
    for (const name of ["1", "2", "Add", "3", "Equals"])
      await user.click(screen.getByRole("button", { name }));
    expect(document.querySelector("output")!.textContent).toBe("15");
    expect(screen.queryByRole("button", { name: "Square root" })).toBeNull();
  });

  it.each([
    ["basic", ["0", ".", "="]],
    ["sqrt", ["0", ".", "√", "="]],
  ] as const)(
    "lays the %s keypad out as five full rows of four, operators in the right-hand column",
    (tier, lastRow) => {
      open(tier);
      const keys = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".simple-calculator-keys button",
        ),
      ];
      // A wide key takes two cells; every row is full.
      const cells = keys.reduce(
        (total, key) => total + (key.classList.contains("wide") ? 2 : 1),
        0,
      );
      expect(cells).toBe(20);
      const labels = keys.map((key) => key.textContent);
      expect(labels.slice(0, 16)).toEqual([
        "C",
        "⌫",
        "±",
        "÷",
        "7",
        "8",
        "9",
        "×",
        "4",
        "5",
        "6",
        "−",
        "1",
        "2",
        "3",
        "+",
      ]);
      expect(labels.slice(16)).toEqual(lastRow);
    },
  );

  it("takes keys typed on the keypad, and Clear calculator resets it", async () => {
    const user = open("sqrt");
    expect(
      screen.getByRole("heading", { name: "Square root calculator" }),
    ).toBeTruthy();
    screen.getByRole("group", { name: "Square root calculator" }).focus();
    await user.keyboard("81r");
    expect(document.querySelector("output")!.textContent).toBe("9");
    await user.click(screen.getByRole("button", { name: "Clear calculator" }));
    expect(document.querySelector("output")!.textContent).toBe("0");
  });
});
