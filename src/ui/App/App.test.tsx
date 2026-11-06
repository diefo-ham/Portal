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
