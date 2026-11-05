/** What a key press means on the Practice screen. */
export type PracticeKeyAction =
  | { type: "close-disclosure"; disclosure: Element }
  | { type: "leave" }
  | { type: "bookmark" }
  | { type: "choose"; id: string }
  | { type: "navigate"; index: number }
  | { type: "finish" }
  | { type: "submit" }
  /** Enter or Space with nothing to do: swallowed so the page does not scroll. */
  | { type: "ignore" };

export type PracticeKeyState = {
  /** Paused, a panel is open, or a save is running. */
  blocked: boolean;
  choices?: { id: string }[];
  isChoice: boolean;
  answered: boolean;
  /** There is an answer that could be checked now. */
  canSubmit: boolean;
  index: number;
  total: number;
};

export type PracticeKey = Pick<
  KeyboardEvent,
  | "key"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "repeat"
  | "defaultPrevented"
  | "target"
>;

const TYPING =
  'textarea,select,input:not([type="radio"]),[contenteditable="true"],[role="textbox"]';
const CONTROL =
  'button,input,a,summary,[role="button"],[role="combobox"],[role="listbox"],[role="slider"],[role="spinbutton"],[role="switch"],[role="checkbox"],[role="menuitem"]';
const ARROW_OWNERS =
  'input,[role="slider"],[role="spinbutton"],[role="listbox"],[role="combobox"]';
const ACTIVATABLE =
  'button,input,a,[role="button"],[role="slider"],[role="spinbutton"]';

const within = (target: EventTarget | null, selector: string) =>
  target instanceof HTMLElement ? target.closest(selector) : null;

/**
 * The single-key shortcuts: Escape leaves (or closes an open disclosure),
 * E bookmarks, A–D or 1–4 choose, ←/→ move, Enter or Space checks or moves on.
 * Keys typed into a field, with a modifier, or while blocked are left alone.
 * Returns null when the key is not a shortcut here.
 */
export function practiceKeyAction(
  event: PracticeKey,
  state: PracticeKeyState,
): PracticeKeyAction | null {
  const { target } = event;
  if (
    event.defaultPrevented ||
    state.blocked ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat ||
    within(target, TYPING)
  )
    return null;
  if (event.key === "Escape") {
    const disclosure =
      target instanceof Element && target.closest("details[open]");
    return disclosure
      ? { type: "close-disclosure", disclosure }
      : { type: "leave" };
  }
  const focusedControl = within(target, CONTROL);
  if (event.key.toLowerCase() === "e" && !focusedControl)
    return { type: "bookmark" };
  const choice = /^[1-4]$/.test(event.key)
    ? state.choices?.[Number(event.key) - 1]
    : state.choices?.find(
        (c) => c.id.toLowerCase() === event.key.toLowerCase(),
      );
  const onRadio = target instanceof HTMLInputElement && target.type === "radio";
  if (
    !state.answered &&
    state.isChoice &&
    choice &&
    (!focusedControl || onRadio)
  )
    return { type: "choose", id: choice.id };
  if (
    (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
    !within(target, ARROW_OWNERS)
  ) {
    const index = state.index + (event.key === "ArrowLeft" ? -1 : 1);
    return index >= 0 && index < state.total
      ? { type: "navigate", index }
      : null;
  }
  if (!within(target, ACTIVATABLE)) {
    if (event.key !== "Enter" && event.key !== " ") return null;
    if (state.answered)
      return state.index < state.total - 1
        ? { type: "navigate", index: state.index + 1 }
        : { type: "finish" };
    return state.canSubmit ? { type: "submit" } : { type: "ignore" };
  }
  if (event.key === "Enter" && onRadio && state.canSubmit && !state.answered)
    return { type: "submit" };
  return null;
}
