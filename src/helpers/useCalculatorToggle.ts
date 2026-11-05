import { useEffect, useState } from "react";

export type CalculatorToggleOptions = {
  /** Whether this screen offers the calculator at all. */
  available: boolean;
  /** A dialog, a save or a pause is in the way: the shortcut does nothing. */
  blocked: boolean;
  /** A paused session closes the calculator. */
  paused: boolean;
  /** The calculator's work, saved before it hides. */
  work: { flush: () => Promise<unknown> };
  /** Where focus goes after the \ shortcut if the previous element is gone. */
  returnFocus: () => HTMLElement | null;
  /** Where focus goes after the calculator is closed with its button. */
  focusAfterClose: () => HTMLElement | null;
};

/**
 * Opens and closes the floating calculator, including the \ (Backslash)
 * shortcut, which toggles it without moving focus.
 */
export const useCalculatorToggle = ({
  available,
  blocked,
  paused,
  work,
  returnFocus,
  focusAfterClose,
}: CalculatorToggleOptions) => {
  const [open, setOpen] = useState(false);
  const [autoFocus, setAutoFocus] = useState(true);
  useEffect(() => {
    if (!available || blocked) return;
    const shortcutIsInappropriate = () =>
      !!document.querySelector('dialog[open],[aria-modal="true"]');
    const keydown = (event: KeyboardEvent) => {
      if (
        event.code !== "Backslash" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        shortcutIsInappropriate()
      )
        return;
      event.preventDefault();
      if (event.repeat) return;
      const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (open) void work.flush().catch(() => {});
      setAutoFocus(false);
      setOpen((visible) => !visible);
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        else returnFocus()?.focus({ preventScroll: true });
      });
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available, work, blocked]);
  useEffect(() => {
    if (paused) setOpen(false);
  }, [paused]);
  return {
    open,
    /** Open and offered here. */
    visible: available && open,
    autoFocus,
    show: () => {
      setAutoFocus(true);
      setOpen(true);
    },
    close: () => {
      void work.flush().catch(() => {});
      setOpen(false);
      requestAnimationFrame(() =>
        focusAfterClose()?.focus({ preventScroll: true }),
      );
    },
    /** Hides it without saving or moving focus (the caller already saved). */
    hide: () => setOpen(false),
  };
};
