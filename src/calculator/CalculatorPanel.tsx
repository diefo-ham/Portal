import { lazy, Suspense } from "react";
import type { CalculatorState } from "./model";
const Surface = lazy(() => import("./CalculatorSurface"));

export function CalculatorPanel({
  state,
  onChange,
  expanded,
  onExpand,
  onClose,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className={`calculator-sheet ${expanded ? "calc-expanded" : ""}`}
      aria-label="Calculator panel"
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (expanded && event.key === "Tab") {
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button,input,select,textarea,summary,iframe,[tabindex="0"]',
            ),
          ].filter((element) => {
            const closed = element.closest("details:not([open])");
            const rect = element.getBoundingClientRect();
            return (
              !element.classList.contains("calculator-focus-end") &&
              !element.hasAttribute("disabled") &&
              element.tabIndex >= 0 &&
              rect.width > 0 &&
              rect.height > 0 &&
              (!closed ||
                (element.tagName === "SUMMARY" &&
                  element.parentElement === closed))
            );
          });
          const target =
            event.shiftKey && document.activeElement === controls[0]
              ? controls.at(-1)
              : !event.shiftKey && document.activeElement === controls.at(-1)
                ? controls[0]
                : undefined;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }
        if (
          event.key === "Escape" &&
          !(event.target instanceof HTMLSelectElement)
        ) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <Suspense fallback={<p className="small muted">Opening calculator…</p>}>
        <Surface
          state={state}
          onChange={onChange}
          expanded={expanded}
          onExpand={onExpand}
          onClose={onClose}
        />
      </Suspense>
      {expanded && (
        <span
          tabIndex={0}
          className="sr-only calculator-focus-end"
          onFocus={(event) =>
            event.currentTarget
              .closest("aside")
              ?.querySelector<HTMLElement>("button:not([disabled])")
              ?.focus()
          }
        />
      )}
    </aside>
  );
}
