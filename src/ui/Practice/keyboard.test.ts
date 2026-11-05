// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  practiceKeyAction,
  type PracticeKey,
  type PracticeKeyState,
} from "./keyboard";

afterEach(() => {
  document.body.innerHTML = "";
});

const state = (
  overrides: Partial<PracticeKeyState> = {},
): PracticeKeyState => ({
  blocked: false,
  choices: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
  isChoice: true,
  answered: false,
  canSubmit: false,
  index: 1,
  total: 3,
  ...overrides,
});

const element = (html: string, selector = "[data-target]") => {
  document.body.innerHTML = html;
  return document.querySelector(selector) as HTMLElement;
};

const key = (
  name: string,
  target: EventTarget | null = document.body,
  extra: Partial<PracticeKey> = {},
): PracticeKey => ({
  key: name,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  defaultPrevented: false,
  target,
  ...extra,
});

describe("practiceKeyAction", () => {
  describe("is ignored", () => {
    it.each([
      ["with a modifier", { altKey: true }],
      ["with Ctrl", { ctrlKey: true }],
      ["with Cmd", { metaKey: true }],
      ["with Shift", { shiftKey: true }],
      ["on a repeat", { repeat: true }],
      ["when already handled", { defaultPrevented: true }],
    ])("%s", (_, extra) => {
      expect(
        practiceKeyAction(key("B", document.body, extra), state()),
      ).toBeNull();
    });

    it("while blocked", () => {
      expect(practiceKeyAction(key("B"), state({ blocked: true }))).toBeNull();
      expect(
        practiceKeyAction(key("Escape"), state({ blocked: true })),
      ).toBeNull();
    });

    it.each([
      ["a text field", '<input data-target type="text">'],
      ["a number field", '<input data-target inputmode="text">'],
      ["a text area", "<textarea data-target></textarea>"],
      ["a select", "<select data-target></select>"],
      [
        "an editable region",
        '<div contenteditable="true"><span data-target></span></div>',
      ],
      ["a textbox role", '<div role="textbox" data-target></div>'],
    ])("while typing in %s", (_, html) => {
      const target = element(html);
      expect(practiceKeyAction(key("B", target), state())).toBeNull();
      expect(practiceKeyAction(key("Escape", target), state())).toBeNull();
    });

    it("for keys that are not shortcuts", () => {
      expect(practiceKeyAction(key("x"), state())).toBeNull();
      expect(practiceKeyAction(key("Tab"), state())).toBeNull();
    });
  });

  describe("Escape", () => {
    it("offers to leave", () => {
      expect(practiceKeyAction(key("Escape"), state())).toEqual({
        type: "leave",
      });
    });

    it("closes an open disclosure first", () => {
      const target = element(
        "<details open><summary data-target>More</summary></details>",
      );
      const action = practiceKeyAction(key("Escape", target), state());
      expect(action).toEqual({
        type: "close-disclosure",
        disclosure: document.querySelector("details"),
      });
    });

    it("leaves when the disclosure around focus is closed", () => {
      const target = element(
        "<details><summary data-target>More</summary></details>",
      );
      expect(practiceKeyAction(key("Escape", target), state())).toEqual({
        type: "leave",
      });
    });
  });

  describe("E", () => {
    it("bookmarks, in either case", () => {
      expect(practiceKeyAction(key("e"), state())).toEqual({
        type: "bookmark",
      });
      expect(practiceKeyAction(key("E"), state())).toEqual({
        type: "bookmark",
      });
    });

    it("is left to a focused control", () => {
      const target = element("<button data-target>x</button>");
      expect(practiceKeyAction(key("e", target), state())).toBeNull();
    });
  });

  describe("choosing", () => {
    it("picks a choice by letter, in either case", () => {
      expect(practiceKeyAction(key("b"), state())).toEqual({
        type: "choose",
        id: "B",
      });
      expect(practiceKeyAction(key("D"), state())).toEqual({
        type: "choose",
        id: "D",
      });
    });

    it("picks a choice by number", () => {
      expect(practiceKeyAction(key("1"), state())).toEqual({
        type: "choose",
        id: "A",
      });
      expect(practiceKeyAction(key("4"), state())).toEqual({
        type: "choose",
        id: "D",
      });
    });

    it("ignores a number past the choices", () => {
      expect(
        practiceKeyAction(
          key("4"),
          state({ choices: [{ id: "A" }, { id: "B" }] }),
        ),
      ).toBeNull();
      expect(practiceKeyAction(key("5"), state())).toBeNull();
    });

    it("works from a radio button", () => {
      const target = element('<input data-target type="radio">');
      expect(practiceKeyAction(key("c", target), state())).toEqual({
        type: "choose",
        id: "C",
      });
    });

    it("is left to another focused control", () => {
      const target = element("<button data-target>x</button>");
      expect(practiceKeyAction(key("b", target), state())).toBeNull();
    });

    it("does nothing once answered or for a numeric question", () => {
      expect(practiceKeyAction(key("b"), state({ answered: true }))).toBeNull();
      expect(
        practiceKeyAction(
          key("b"),
          state({ isChoice: false, choices: undefined }),
        ),
      ).toBeNull();
    });
  });

  describe("arrows", () => {
    it("move to the previous and next question", () => {
      expect(practiceKeyAction(key("ArrowLeft"), state())).toEqual({
        type: "navigate",
        index: 0,
      });
      expect(practiceKeyAction(key("ArrowRight"), state())).toEqual({
        type: "navigate",
        index: 2,
      });
    });

    it("stop at the ends", () => {
      expect(
        practiceKeyAction(key("ArrowLeft"), state({ index: 0 })),
      ).toBeNull();
      expect(
        practiceKeyAction(key("ArrowRight"), state({ index: 2 })),
      ).toBeNull();
    });

    it("are left to radios, sliders and lists, which use them", () => {
      for (const html of [
        '<input data-target type="radio">',
        '<div role="slider" data-target></div>',
        '<div role="listbox" data-target></div>',
      ]) {
        const target = element(html);
        expect(
          practiceKeyAction(key("ArrowRight", target), state()),
        ).toBeNull();
      }
    });

    it("work from a focused button", () => {
      const target = element("<button data-target>x</button>");
      expect(practiceKeyAction(key("ArrowRight", target), state())).toEqual({
        type: "navigate",
        index: 2,
      });
    });
  });

  describe("Enter and Space", () => {
    it.each(["Enter", " "])("%j checks an answer that is ready", (name) => {
      expect(practiceKeyAction(key(name), state({ canSubmit: true }))).toEqual({
        type: "submit",
      });
    });

    it("is swallowed when there is nothing to check yet", () => {
      expect(practiceKeyAction(key("Enter"), state())).toEqual({
        type: "ignore",
      });
    });

    it("moves on once answered", () => {
      expect(
        practiceKeyAction(key("Enter"), state({ answered: true })),
      ).toEqual({
        type: "navigate",
        index: 2,
      });
    });

    it("finishes after the last question is answered", () => {
      expect(
        practiceKeyAction(key(" "), state({ answered: true, index: 2 })),
      ).toEqual({ type: "finish" });
    });

    it("is left to a focused button, which it activates", () => {
      const target = element("<button data-target>x</button>");
      expect(
        practiceKeyAction(key("Enter", target), state({ canSubmit: true })),
      ).toBeNull();
    });

    it("checks from a radio button with Enter, but Space selects", () => {
      const target = element('<input data-target type="radio">');
      expect(
        practiceKeyAction(key("Enter", target), state({ canSubmit: true })),
      ).toEqual({ type: "submit" });
      expect(
        practiceKeyAction(key(" ", target), state({ canSubmit: true })),
      ).toBeNull();
    });

    it("does not check again from a radio once answered", () => {
      const target = element('<input data-target type="radio">');
      expect(
        practiceKeyAction(
          key("Enter", target),
          state({ canSubmit: true, answered: true }),
        ),
      ).toBeNull();
    });
  });
});
