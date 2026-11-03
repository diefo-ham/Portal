/**
 * Safari does not move focus to a button (or checkbox or radio) when it is
 * clicked with the mouse, unlike Chrome, Edge and Firefox. Menus, dialogs and
 * keyboard shortcuts here rely on focus being where the person clicked, so this
 * gives every browser the same behaviour. It runs before the click handler.
 */
export function focusClickedControls(target: Document = document) {
  target.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element | null)?.closest?.(
        'button, input[type="checkbox"], input[type="radio"], summary',
      );
      if (
        element instanceof HTMLElement &&
        element.isConnected &&
        !(element as HTMLButtonElement).disabled &&
        target.activeElement !== element &&
        // Keyboard activation already has focus; this only matters for the mouse.
        (event as MouseEvent).detail > 0
      )
        element.focus({ preventScroll: true });
    },
    true,
  );
}
