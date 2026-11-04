// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "../../core/model";
import { TestList, type TestListProps } from "./TestList";

afterEach(cleanup);

const session = (id: string, name: string, finished = false) =>
  ({
    id,
    name,
    startedAt: "2026-03-14T12:00:00.000Z",
    finishedAt: finished ? "2026-03-14T13:00:00.000Z" : undefined,
  }) as Session;

const setup = (overrides: Partial<TestListProps> = {}) => {
  const props: TestListProps = {
    title: "Your tests",
    tests: [session("a", "First test"), session("b", "Second test", true)],
    meta: (s) => (s.finishedAt ? "done" : "going"),
    openLabel: (s) => (s.finishedAt ? "View" : "Resume"),
    actionsLabel: (s) => `Actions for ${s.name}`,
    menuItems: (s) => [
      { label: "Rename", onSelect: vi.fn() },
      { label: `Delete ${s.id}`, danger: true, onSelect: vi.fn() },
    ],
    onOpen: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<TestList {...props} />);
  return { props, user };
};

describe("TestList", () => {
  it("renders nothing when there are no tests", () => {
    const { container } = render(
      <TestList
        title="Empty"
        tests={[]}
        meta={() => ""}
        openLabel={() => ""}
        actionsLabel={() => ""}
        menuItems={() => []}
        onOpen={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the title and one row per test, in the order given", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Your tests" })).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("First test")).toBeTruthy();
    expect(within(rows[1]).getByText("Second test")).toBeTruthy();
  });

  it("shows the start date followed by the row's own text", () => {
    setup();
    const date = new Date("2026-03-14T12:00:00.000Z").toLocaleDateString();
    expect(screen.getByText(`${date} · going`)).toBeTruthy();
    expect(screen.getByText(`${date} · done`)).toBeTruthy();
  });

  it("labels each open button from the test", () => {
    setup();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View" })).toBeTruthy();
  });

  it("opens a test by its id", async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(props.onOpen).toHaveBeenCalledWith("b");
  });

  it("names each actions button for its test and starts closed", () => {
    setup();
    const trigger = screen.getByRole("button", {
      name: "Actions for First test",
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens and closes a menu from its button", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", {
      name: "Actions for First test",
    });
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the menu items for that test, marking danger ones", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Actions for Second test" }),
    );
    const rename = screen.getByRole("menuitem", { name: "Rename" });
    const remove = screen.getByRole("menuitem", { name: "Delete b" });
    expect(rename.className).toBe("");
    expect(remove.className).toBe("danger");
  });

  it("keeps only one menu open at a time", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Actions for First test" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Actions for Second test" }),
    );
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "Delete b" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete a" })).toBeNull();
  });

  it("closes the menu and runs the chosen item", async () => {
    const onSelect = vi.fn();
    const { user } = setup({
      menuItems: () => [{ label: "Rename", onSelect }],
    });
    await user.click(
      screen.getByRole("button", { name: "Actions for First test" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
