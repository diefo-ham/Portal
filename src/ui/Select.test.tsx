// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select, type SelectOption } from "./Select";

afterEach(cleanup);

type Fruit = "apple" | "pear" | "plum";
const fruits: SelectOption<Fruit>[] = [
  { value: "apple", label: "Apple" },
  { value: "pear", label: "Pear" },
  { value: "plum", label: "Plum", disabled: true },
];

const setup = (value: Fruit = "apple") => {
  const onChange = vi.fn<(value: Fruit) => void>();
  render(
    <Select
      aria-label="Fruit"
      value={value}
      options={fruits}
      onChange={onChange}
    />,
  );
  const select = screen.getByRole("combobox", {
    name: "Fruit",
  }) as HTMLSelectElement;
  return { onChange, select };
};

describe("Select", () => {
  it("lists the options in order and shows the value", () => {
    const { select } = setup("pear");
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Apple",
      "Pear",
      "Plum",
    ]);
    expect(select.value).toBe("pear");
  });

  it("disables the options marked so", () => {
    const { select } = setup();
    expect(select.options[2].disabled).toBe(true);
    expect(select.options[0].disabled).toBe(false);
  });

  it("reports the chosen option's typed value", async () => {
    const { onChange, select } = setup();
    await userEvent.setup().selectOptions(select, "pear");
    expect(onChange).toHaveBeenCalledWith("pear");
  });

  it("ignores a value that is not one of its options", () => {
    const { onChange, select } = setup();
    const stray = document.createElement("option");
    stray.value = "banana";
    select.append(stray);
    fireEvent.change(select, { target: { value: "banana" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("passes other attributes to the native select", () => {
    render(
      <Select
        aria-label="Kind"
        className="wide"
        disabled
        value="apple"
        options={fruits}
        onChange={() => {}}
      />,
    );
    const select = screen.getByRole("combobox", {
      name: "Kind",
    }) as HTMLSelectElement;
    expect(select.className).toBe("wide");
    expect(select.disabled).toBe(true);
  });
});
