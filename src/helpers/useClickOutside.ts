import { useEffect, useRef, type RefObject } from "react";
import { containsTarget } from "@/src/utils/dom";

/**
 * While `active`, a pointer press anywhere outside `ref`'s element calls
 * `onOutside`, as when a menu or popover should close.
 */
export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) => {
  // The latest callback, without re-subscribing on every render.
  const callback = useRef(onOutside);
  callback.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const press = (event: PointerEvent) => {
      if (!containsTarget(ref.current, event.target)) callback.current();
    };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [active, ref]);
};
