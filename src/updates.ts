/**
 * Knows when a newer build of the app has been downloaded and is waiting, and
 * lets the person switch to it. The offline copy otherwise keeps showing the old
 * version until every tab is closed, which is easy to miss.
 */
type Listener = () => void;

let waiting: Pick<ServiceWorker, "postMessage"> | undefined;
let asked = false;
const listeners = new Set<Listener>();

const announce = (worker: Pick<ServiceWorker, "postMessage">) => {
  waiting = worker;
  listeners.forEach((listener) => listener());
};

export const subscribeToUpdates = (listener: Listener) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const updateReady = () => waiting !== undefined;

/** Switches to the waiting version; the page reloads once it has taken over. */
export function applyUpdate() {
  asked = true;
  waiting?.postMessage({ type: "SKIP_WAITING" });
}

interface WorkerLike extends EventTarget {
  state: string;
  postMessage(message: unknown): void;
}
interface RegistrationLike extends EventTarget {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  update(): Promise<unknown>;
}

/** `hasController` is false on a first visit, when there is nothing to replace. */
export function watchRegistration(
  registration: RegistrationLike,
  hasController: () => boolean,
) {
  if (registration.waiting && hasController()) announce(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && hasController()) announce(worker);
    });
  });
  // A tab left open for days still notices new builds.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible")
      void registration.update().catch(() => {});
  });
}

export function registerWorker(url: string) {
  navigator.serviceWorker
    .register(url)
    .then((registration) =>
      watchRegistration(
        registration,
        () => !!navigator.serviceWorker.controller,
      ),
    )
    .catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (asked) location.reload();
  });
}
