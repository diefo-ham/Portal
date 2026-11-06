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
  const show = (data: StudyData, onChange = vi.fn()) => {
    render(
      <AssessmentProvider value="TSI">
        <Filters
          data={data}
          value={{ ...defaultFilters, statuses: [] }}
          onChange={onChange}
        />
      </AssessmentProvider>,
    );
    return { onChange, user: userEvent.setup() };
  };

  it("is offered when the bank holds both kinds, and sets the origins", async () => {
    const { onChange, user } = show(
      bank(question("a", { origin: "official" }), question("b")),
    );
    await user.click(
      screen.getByRole("button", { name: /Official and original/ }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Original" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ origins: ["original"] }),
    );
  });

  it("is left out when only one kind is stored, so it adds no control", () => {
    show(bank(question("a"), question("b")));
    expect(screen.queryByText("Source")).toBeNull();
  });
});

describe("badges beside a question", () => {
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

  it("shows Official or Original and the calculator tier", () => {
    heading(question("a", { origin: "official", calculator: "sqrt" }));
    expect(screen.getByText("Official").getAttribute("title")).toBe(
      "College Board sample item",
    );
    expect(screen.getByText("Square root calculator")).toBeTruthy();
  });

  it("shows nothing extra for a question without them (SAT, PAA)", () => {
    heading({ ...question("b"), origin: undefined, calculator: undefined });
    expect(screen.queryByText("Original")).toBeNull();
    expect(screen.queryByText(/calculator/)).toBeNull();
  });
});

describe("Settings", () => {
  it("offers the switch for sample items only when it is given", async () => {
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
    expect(screen.queryByText("Include College Board sample items")).toBeNull();
    rerender(
      <AssessmentProvider value="TSI">
        <StudyPreferences
          {...props}
          officialItems={{ checked: true, onChange }}
        />
      </AssessmentProvider>,
    );
    await userEvent.click(
      screen.getByLabelText("Include College Board sample items"),
    );
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("removes the official items only after a confirmation", async () => {
    const onRemove = vi.fn(() => Promise.resolve());
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
          official={{ count: 30, onRemove }}
        />
      </AssessmentProvider>,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Remove official items" }),
    );
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Remove official items" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Remove official items" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Yes, remove 30 official items" }),
    );
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not offer removal when there are no official items", () => {
    render(
      <AssessmentProvider value="TSI">
        <MaintenanceSection
          data={bank(question("b"))}
          busy={false}
          onAddPdfs={vi.fn()}
          onRemovePdf={vi.fn()}
          onRestore={vi.fn()}
          onReset={vi.fn()}
          onRemoveQuestions={vi.fn()}
          onEraseEverything={vi.fn()}
          official={{ count: 0, onRemove: vi.fn() }}
        />
      </AssessmentProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Remove official items" }),
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
