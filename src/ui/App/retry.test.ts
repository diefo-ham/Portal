import { describe, expect, it } from "vitest";
import { defaultFilters, type Filters } from "../../core/model";
import {
  practiceTestRetryFilters,
  reviewFilters,
  sessionRetry,
  timedTestRetryFilters,
} from "./retry";

describe("timedTestRetryFilters", () => {
  it("includes every question and keeps the rest of the defaults", () => {
    const filters = timedTestRetryFilters("entire");
    expect(filters).toEqual({
      ...defaultFilters,
      active: "include",
      status: "",
      statuses: [],
    });
  });

  it("narrows to mistakes", () => {
    const filters = timedTestRetryFilters("mistakes");
    expect(filters.status).toBe("incorrect");
    expect(filters.statuses).toEqual(["incorrect"]);
    expect(filters.active).toBe("include");
  });

  it("narrows to unanswered questions", () => {
    const filters = timedTestRetryFilters("unanswered");
    expect(filters.status).toBe("unanswered");
    expect(filters.statuses).toEqual(["unanswered"]);
  });
});

describe("practiceTestRetryFilters", () => {
  it("stays among active questions", () => {
    expect(practiceTestRetryFilters("entire")).toEqual({
      ...defaultFilters,
      active: "only",
      status: "",
      statuses: [],
    });
  });

  it("sets the legacy status for mistakes and unanswered, but not the list", () => {
    expect(practiceTestRetryFilters("mistakes")).toMatchObject({
      active: "only",
      status: "incorrect",
      statuses: [],
    });
    expect(practiceTestRetryFilters("unanswered")).toMatchObject({
      active: "only",
      status: "unanswered",
      statuses: [],
    });
  });
});

describe("sessionRetry", () => {
  const filters: Filters = {
    ...defaultFilters,
    domain: "Algebra",
    sections: ["math"],
    status: "unanswered",
    statuses: ["unanswered"],
  };

  it("repeats the whole session with the same filters", () => {
    const retry = sessionRetry({ filters, name: "Morning set" }, "entire");
    expect(retry.filters).toEqual(filters);
    expect(retry.name).toBe("Morning set — Repractice");
  });

  it("does not change the original filters", () => {
    const before = structuredClone(filters);
    sessionRetry({ filters, name: "x" }, "mistakes");
    expect(filters).toEqual(before);
  });

  it("narrows to mistakes and keeps the other filters", () => {
    const retry = sessionRetry({ filters, name: "Morning set" }, "mistakes");
    expect(retry.filters).toMatchObject({
      domain: "Algebra",
      sections: ["math"],
      status: "incorrect",
      statuses: ["incorrect"],
    });
    expect(retry.name).toBe("Morning set — Mistakes");
  });

  it("narrows to unanswered questions", () => {
    const retry = sessionRetry({ filters, name: "Morning set" }, "unanswered");
    expect(retry.filters).toMatchObject({
      status: "unanswered",
      statuses: ["unanswered"],
    });
    expect(retry.name).toBe("Morning set — Unanswered");
  });

  it("leaves the name empty for an unnamed session", () => {
    expect(sessionRetry({ filters }, "mistakes").name).toBeUndefined();
    expect(sessionRetry({ filters, name: "" }, "entire").name).toBeUndefined();
  });

  it("keeps a long name within the session name limit", () => {
    const retry = sessionRetry({ filters, name: "x".repeat(200) }, "entire");
    expect(retry.name!.length).toBeLessThanOrEqual(80);
  });
});

describe("reviewFilters", () => {
  it("hides active questions when tests are protected", () => {
    expect(reviewFilters("mistakes", true).active).toBe("hide");
  });

  it("includes active questions when they are not protected", () => {
    expect(reviewFilters("mistakes", false).active).toBe("include");
  });

  it("starts from mistakes", () => {
    expect(reviewFilters("mistakes", true)).toMatchObject({
      status: "incorrect",
      statuses: ["incorrect"],
      bookmark: "",
    });
  });

  it("starts from unanswered questions", () => {
    expect(reviewFilters("unanswered", true)).toMatchObject({
      status: "unanswered",
      statuses: ["unanswered"],
      bookmark: "",
    });
  });

  it("starts from bookmarks without an answer filter", () => {
    expect(reviewFilters("bookmarks", true)).toMatchObject({
      status: "",
      statuses: [],
      bookmark: "yes",
    });
  });

  it("starts from everything when there is no source", () => {
    expect(reviewFilters(undefined, false)).toEqual({
      ...defaultFilters,
      active: "include",
      status: "",
      statuses: [],
      bookmark: "",
    });
  });
});
