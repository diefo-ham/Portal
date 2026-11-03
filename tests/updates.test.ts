import { describe, expect, it, vi } from "vitest";

class Fake extends EventTarget {
  state = "installing";
  posted: unknown[] = [];
  postMessage(message: unknown) {
    this.posted.push(message);
  }
}

describe("update notice", () => {
  it("announces a waiting build only when an older one is already in control", async () => {
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), { visibilityState: "visible" }),
    );
    const updates = await import("../src/updates");
    const seen = vi.fn();
    updates.subscribeToUpdates(seen);

    // First visit: nothing to replace, so no notice.
    const first = Object.assign(new EventTarget(), {
      waiting: null as Fake | null,
      installing: null as Fake | null,
      update: async () => {},
    });
    updates.watchRegistration(first, () => false);
    const early = new Fake();
    first.installing = early;
    first.dispatchEvent(new Event("updatefound"));
    early.state = "installed";
    early.dispatchEvent(new Event("statechange"));
    expect(updates.updateReady()).toBe(false);

    // Later visit: a newer build finishes installing while the old one runs.
    const second = Object.assign(new EventTarget(), {
      waiting: null as Fake | null,
      installing: null as Fake | null,
      update: async () => {},
    });
    updates.watchRegistration(second, () => true);
    const next = new Fake();
    second.installing = next;
    second.dispatchEvent(new Event("updatefound"));
    next.state = "installed";
    next.dispatchEvent(new Event("statechange"));
    expect(updates.updateReady()).toBe(true);
    expect(seen).toHaveBeenCalled();

    updates.applyUpdate();
    expect(next.posted).toEqual([{ type: "SKIP_WAITING" }]);
    vi.unstubAllGlobals();
  });
});
