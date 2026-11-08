// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type Assessment, type StudyData } from "../../core/model";
import { testCorpus } from "../../../tests/practiceTestFixtures";
import { translator } from "../i18n";
import { App } from "./App";

// The real store is IndexedDB; here the screen is driven by what it returns.
const study = vi.hoisted(() => ({ useStudy: vi.fn() }));
vi.mock("../useStudy", () => study);

const answer = (overrides: Record<string, unknown> = {}) => ({
  data: testCorpus(2) as StudyData | undefined,
  archive: undefined,
  mutate: vi.fn(async () => emptyData()),
  adoptLibrary: vi.fn(),
  error: "",
  setError: vi.fn(),
  saving: false,
  loadingMessage: "Opening your local library…",
  ...overrides,
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  study.useStudy.mockImplementation(() => answer());
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = "";
  document.documentElement.lang = "";
  document.documentElement.removeAttribute("data-theme");
  vi.clearAllMocks();
});

const nav = () => screen.getByRole("navigation");
const assessmentsAsked = () =>
  study.useStudy.mock.calls.map((call) => call[0] as Assessment);

describe("loading", () => {
  it("shows the loading message until the data arrives", () => {
    study.useStudy.mockImplementation(() => answer({ data: undefined }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "SAT Study" })).toBeTruthy();
    expect(screen.getByText("Opening your local library…")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows the error with a way to try again when loading fails", () => {
    study.useStudy.mockImplementation(() =>
      answer({ data: undefined, error: "Storage is blocked." }),
    );
    render(<App />);
    expect(screen.getByText("Storage is blocked.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("choosing the test", () => {
  it("starts on the SAT in a fresh browser", () => {
    render(<App />);
    expect(assessmentsAsked().at(-1)).toBe("SAT");
    expect(screen.getByRole("button", { name: /SAT Study/ })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });

  it("follows a link to the PAA", () => {
    location.hash = "#/paa";
    render(<App />);
    expect(assessmentsAsked().at(-1)).toBe("PAA");
    expect(screen.getByRole("button", { name: /PAA Study/ })).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
  });

  it("reopens the test used last", () => {
    localStorage.setItem("sat-last-assessment", "PAA");
    render(<App />);
    expect(assessmentsAsked().at(-1)).toBe("PAA");
  });

  it("prefers the link over the remembered test", () => {
    localStorage.setItem("sat-last-assessment", "PAA");
    location.hash = "#/sat";
    render(<App />);
    expect(assessmentsAsked().at(-1)).toBe("SAT");
  });

  it("ignores a remembered value that is not a test", () => {
    localStorage.setItem("sat-last-assessment", "GRE");
    render(<App />);
    expect(assessmentsAsked().at(-1)).toBe("SAT");
  });

  it("switches test from the header, and remembers it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Switch to PAA" }));
    expect(location.hash).toBe("#/paa");
    expect(localStorage.getItem("sat-last-assessment")).toBe("PAA");
    expect(assessmentsAsked().at(-1)).toBe("PAA");
    expect(screen.getByRole("button", { name: /PAA Study/ })).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
  });

  it("follows the address when it changes", () => {
    render(<App />);
    act(() => {
      location.hash = "#/paa";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(assessmentsAsked().at(-1)).toBe("PAA");
    expect(screen.getByRole("button", { name: /PAA Study/ })).toBeTruthy();
  });

  it("uses the PAA's own navigation", () => {
    location.hash = "#/paa";
    render(<App />);
    expect(within(nav()).queryByRole("button", { name: "Tests" })).toBeNull();
    expect(within(nav()).getAllByRole("button").length).toBeGreaterThanOrEqual(
      5,
    );
  });
});

describe("navigating", () => {
  const current = () =>
    within(nav())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-current") === "page")
      .map((b) => b.textContent);

  it("opens on Practice", () => {
    render(<App />);
    expect(current()).toEqual(["Practice"]);
  });

  it("moves between pages from the header", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(current()).toEqual(["Review"]);
    await user.click(screen.getByRole("button", { name: "Browse" }));
    expect(current()).toEqual(["Browse"]);
    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(current()).toEqual(["Tests"]);
    await user.click(screen.getByRole("button", { name: "Practice" }));
    expect(current()).toEqual(["Practice"]);
  });

  it("goes home from the brand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: /SAT Study/ }));
    expect(current()).toEqual(["Practice"]);
  });

  it("shows the Practice Test page under Tests for the SAT", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(
      screen.getByRole("heading", { name: "A test, at your pace." }),
    ).toBeTruthy();
  });
});

describe("tests and the bundled examples", () => {
  const bundledOnly = (assessment?: Assessment) => {
    const data = testCorpus(2);
    data.questions = data.questions.map((q) => ({
      ...q,
      ...(assessment ? { assessment } : {}),
      bundled: true as const,
    }));
    return data;
  };

  it("keeps Tests locked, but visible, until questions of your own are added", async () => {
    study.useStudy.mockImplementation(() => answer({ data: bundledOnly() }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(
      screen.getByRole("heading", {
        name: "Tests open when you add your own questions.",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "A test, at your pace." }),
    ).toBeNull();
  });

  it("opens the test setup as soon as one question is the person's own", async () => {
    const data = bundledOnly();
    data.questions[0] = { ...data.questions[0], bundled: undefined };
    study.useStudy.mockImplementation(() => answer({ data }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tests" }));
    expect(
      screen.getByRole("heading", { name: "A test, at your pace." }),
    ).toBeTruthy();
  });

  it("locks Test mode in Spanish on the PAA", async () => {
    location.hash = "#/paa";
    study.useStudy.mockImplementation(() =>
      answer({ data: bundledOnly("PAA") }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Modo de prueba" }));
    expect(
      screen.getByRole("heading", {
        name: "Las pruebas se abren cuando agregas tus propias preguntas.",
      }),
    ).toBeTruthy();
  });
});

describe("Settings with and without questions of your own", () => {
  const openSettings = async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    return user;
  };
  const stored = () => screen.getByText(/questions · \d+ attempts/).textContent;
  /** The person's own questions, plus two bundled examples. */
  const mixed = () => {
    const data = testCorpus(2);
    const own = data.questions.length;
    data.questions.push(
      ...data.questions.slice(0, 2).map((q, i) => ({
        ...q,
        id: `example-${i}`,
        bundled: true as const,
      })),
    );
    return { data, own };
  };

  it("offers no protection setting and no examples switch with only the examples", async () => {
    const data = testCorpus(2);
    data.questions = data.questions.map((q) => ({
      ...q,
      bundled: true as const,
    }));
    study.useStudy.mockImplementation(() => answer({ data }));
    await openSettings();
    expect(
      screen.queryByRole("checkbox", {
        name: "Protect unused practice-test questions",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: "Include example questions" }),
    ).toBeNull();
  });

  it("offers the protection setting once there are questions of your own", async () => {
    const { data } = mixed();
    study.useStudy.mockImplementation(() => answer({ data }));
    await openSettings();
    expect(
      screen.getByRole("checkbox", {
        name: "Protect unused practice-test questions",
      }),
    ).toBeTruthy();
  });

  it("hides the examples by default once there are questions of your own, and brings them back on request", async () => {
    const { data, own } = mixed();
    study.useStudy.mockImplementation(() => answer({ data }));
    const user = await openSettings();
    expect(stored()).toMatch(new RegExp(`^${own} questions`));
    const toggle = screen.getByRole("checkbox", {
      name: "Include example questions",
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await user.click(toggle);
    expect(stored()).toMatch(new RegExp(`^${own + 2} questions`));
  });

  /** The person's own TSI questions, plus two bundled examples. */
  const tsiMixed = () => {
    const data = testCorpus(2);
    data.questions = data.questions.map((q) => ({
      ...q,
      id: `tsi-${q.id}`,
      assessment: "TSI" as const,
      section: "tsi-math" as const,
    }));
    const own = data.questions.length;
    data.questions.push(
      ...data.questions.slice(0, 2).map((q, i) => ({
        ...q,
        id: `tsi-example-${i}`,
        bundled: true as const,
      })),
    );
    return { data, own };
  };

  /** The person's own PAA questions, plus two bundled PAA examples. */
  const paaMixed = () => {
    const data = testCorpus(2);
    data.questions = data.questions.map((q) => ({
      ...q,
      id: `paa-${q.id}`,
      assessment: "PAA" as const,
      section: "matematicas" as const,
    }));
    const own = data.questions.length;
    data.questions.push(
      ...data.questions.slice(0, 2).map((q, i) => ({
        ...q,
        id: `paa-example-${i}`,
        bundled: true as const,
      })),
    );
    return { data, own };
  };
  const checkbox = () =>
    screen.getByRole("checkbox", {
      name: "Include example questions",
    }) as HTMLInputElement;

  it("shows the TSI examples by default even with questions of your own, and lets you turn them off", async () => {
    location.hash = "#/tsi";
    const { data, own } = tsiMixed();
    study.useStudy.mockImplementation(() => answer({ data }));
    const user = await openSettings();
    expect(checkbox().checked).toBe(true);
    expect(stored()).toMatch(new RegExp(`^${own + 2} questions`));
    await user.click(checkbox());
    expect(stored()).toMatch(new RegExp(`^${own} questions`));
    // The TSI has a setting of its own: the one the SAT and PAA share is untouched.
    expect(localStorage.getItem("sat-show-examples-tsi")).toBe("false");
    expect(localStorage.getItem("sat-show-examples")).toBeNull();
  });

  it("keeps the TSI's own choice: off there leaves the SAT as it was, and on in the SAT leaves the TSI as it was", async () => {
    // The TSI is switched off; the SAT and PAA are switched on.
    localStorage.setItem("sat-show-examples-tsi", "false");
    localStorage.setItem("sat-show-examples", "true");
    location.hash = "#/tsi";
    let mixedTsi = tsiMixed();
    study.useStudy.mockImplementation(() => answer({ data: mixedTsi.data }));
    await openSettings();
    expect(checkbox().checked).toBe(false);
    expect(stored()).toMatch(new RegExp(`^${mixedTsi.own} questions`));
    cleanup();
    location.hash = "#/sat";
    const mixedSat = mixed();
    study.useStudy.mockImplementation(() => answer({ data: mixedSat.data }));
    await openSettings();
    expect(checkbox().checked).toBe(true);
    expect(stored()).toMatch(new RegExp(`^${mixedSat.own + 2} questions`));
  });

  it("shares one setting between the SAT and the PAA", async () => {
    // Switched on in the SAT, it is on in the PAA too.
    location.hash = "#/sat";
    const sat = mixed();
    study.useStudy.mockImplementation(() => answer({ data: sat.data }));
    const user = await openSettings();
    expect(checkbox().checked).toBe(false);
    await user.click(checkbox());
    expect(localStorage.getItem("sat-show-examples")).toBe("true");
    expect(localStorage.getItem("sat-show-examples-tsi")).toBeNull();
    cleanup();

    location.hash = "#/paa";
    const paa = paaMixed();
    study.useStudy.mockImplementation(() => answer({ data: paa.data }));
    const t = translator("PAA");
    const spanish = userEvent.setup();
    render(<App />);
    await spanish.click(screen.getByRole("button", { name: t("Settings") }));
    expect(
      (
        screen.getByRole("checkbox", {
          name: t("Include example questions"),
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("offers the SAT and PAA setting when either of them has questions of its own, but not for the TSI's", async () => {
    // Questions of your own for the PAA only: the SAT view offers the shared setting.
    const data = paaMixed().data;
    data.questions.push(
      ...mixed()
        .data.questions.filter((q) => q.bundled === true)
        .map((q) => ({ ...q, id: `sat-${q.id}` })),
      ...tsiMixed()
        .data.questions.filter((q) => q.bundled === true)
        .map((q) => ({ ...q, id: `tsi-${q.id}-x` })),
    );
    study.useStudy.mockImplementation(() => answer({ data }));
    location.hash = "#/sat";
    await openSettings();
    expect(checkbox()).toBeTruthy();
    cleanup();
    // The TSI has examples but none of its own questions, so it offers nothing.
    location.hash = "#/tsi";
    study.useStudy.mockImplementation(() => answer({ data }));
    await openSettings();
    expect(
      screen.queryByRole("checkbox", { name: "Include example questions" }),
    ).toBeNull();
  });

  it("keeps the examples of a test that has no questions of your own", async () => {
    // Own PAA questions exist, so the switch is offered, but the SAT has only examples.
    const data = testCorpus(2);
    data.questions = data.questions.map((q) => ({
      ...q,
      id: `paa-${q.id}`,
      assessment: "PAA" as const,
      section: "matematicas" as const,
    }));
    const ex = testCorpus(2)
      .questions.slice(0, 2)
      .map((q, i) => ({
        ...q,
        id: `example-${i}`,
        bundled: true as const,
      }));
    data.questions.push(...ex);
    study.useStudy.mockImplementation(() => answer({ data }));
    await openSettings();
    expect(
      screen.getByRole("checkbox", { name: "Include example questions" }),
    ).toBeTruthy();
    expect(stored()).toMatch(/^2 questions/);
  });
});

describe("settings", () => {
  const openSettings = async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    return user;
  };

  it("opens from the gear with its footer", async () => {
    await openSettings();
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Made for focused, independent study."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Settings" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("drops the footer on other pages", async () => {
    const user = await openSettings();
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(
      screen.queryByText("Made for focused, independent study."),
    ).toBeNull();
  });

  it("shows the stored preferences", async () => {
    localStorage.setItem("sat-timer-default", "false");
    localStorage.setItem("sat-show-correct-explanations", "true");
    localStorage.setItem("sat-delete-removes-answers", "true");
    localStorage.setItem("sat-protect-tests", "false");
    await openSettings();
    const checked = (name: string) =>
      (screen.getByRole("checkbox", { name }) as HTMLInputElement).checked;
    expect(checked("Timer on by default")).toBe(false);
    expect(checked("Show explanations after correct answers")).toBe(true);
    expect(checked("Deleting a session also removes its answers")).toBe(true);
    expect(checked("Protect unused practice-test questions")).toBe(false);
  });

  it("starts with the defaults in a fresh browser", async () => {
    await openSettings();
    const checked = (name: string) =>
      (screen.getByRole("checkbox", { name }) as HTMLInputElement).checked;
    expect(checked("Timer on by default")).toBe(true);
    expect(checked("Show explanations after correct answers")).toBe(false);
    expect(checked("Deleting a session also removes its answers")).toBe(false);
    expect(checked("Protect unused practice-test questions")).toBe(true);
  });

  it("remembers each change", async () => {
    const user = await openSettings();
    await user.click(
      screen.getByRole("checkbox", { name: "Timer on by default" }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Show explanations after correct answers",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Deleting a session also removes its answers",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Protect unused practice-test questions",
      }),
    );
    expect(localStorage.getItem("sat-timer-default")).toBe("false");
    expect(localStorage.getItem("sat-show-correct-explanations")).toBe("true");
    expect(localStorage.getItem("sat-delete-removes-answers")).toBe("true");
    expect(localStorage.getItem("sat-protect-tests")).toBe("false");
  });

  it("offers question protection for the SAT but not the PAA", async () => {
    await openSettings();
    expect(
      screen.getByRole("checkbox", {
        name: "Protect unused practice-test questions",
      }),
    ).toBeTruthy();
    cleanup();
    location.hash = "#/paa";
    render(<App />);
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: translator("PAA")("Settings") }),
      );
    expect(
      screen.queryByRole("checkbox", { name: /Protect unused/ }),
    ).toBeNull();
  });

  it("counts the stored questions", async () => {
    await openSettings();
    expect(
      screen.getByText(/4 questions are stored in this browser/),
    ).toBeTruthy();
  });
});

describe("notices", () => {
  it("shows a storage error and dismisses it", async () => {
    const setError = vi.fn();
    study.useStudy.mockImplementation(() =>
      answer({ error: "Disk is full.", setError }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("alert").textContent).toContain("Disk is full.");
    await user.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(setError).toHaveBeenCalledWith("");
  });
});
