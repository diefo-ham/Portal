/**
 * Whether an event target is inside a container. Event targets are typed as
 * `EventTarget`, which may not be a DOM node at all, so this checks instead of
 * casting. A missing container contains nothing.
 */
export const containsTarget = (
  container: Node | null | undefined,
  target: EventTarget | null,
): boolean => target instanceof Node && !!container?.contains(target);
