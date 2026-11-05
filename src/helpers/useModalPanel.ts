import { useEffect, useRef, useState } from "react";

/**
 * One native modal <dialog> that shows one of several panels. Opening a panel
 * remembers what had focus so closing can return there; a panel opened from
 * another one remembers its parent so it can offer a Back button.
 */
export const useModalPanel = <Panel extends string>() => {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [parent, setParent] = useState<Panel | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (panel) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) dialog.current.close();
  }, [panel]);
  return {
    panel,
    parent,
    dialog,
    /** Opens a panel on its own, from the page. */
    open: (value: Panel) => {
      if (!panel) trigger.current = document.activeElement as HTMLElement;
      setParent(null);
      setPanel(value);
    },
    /** Opens a panel from inside another one, which Back returns to. */
    openFrom: (from: Panel, value: Panel) => {
      setParent(from);
      setPanel(value);
    },
    /** Shows another panel without changing where Back leads. */
    show: (value: Panel) => setPanel(value),
    /** Returns to the panel this one was opened from. */
    back: () => {
      const from = parent;
      setParent(null);
      setPanel(from);
    },
    close: () => setPanel(null),
    /** For the dialog's close event: forget the panel and restore focus. */
    onClosed: () => {
      setPanel(null);
      setParent(null);
      trigger.current?.focus();
    },
  };
};
