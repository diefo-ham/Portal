import type { ReactNode, SelectHTMLAttributes } from "react";

export type SelectOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps<T extends string> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "children"
> & {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
};

/**
 * A native <select> whose value is typed. The chosen value is looked up among
 * the options instead of being cast from the DOM's string.
 */
export const Select = <T extends string>({
  value,
  options,
  onChange,
  ...rest
}: SelectProps<T>) => (
  <select
    {...rest}
    value={value}
    onChange={(event) => {
      const chosen = options.find(
        (option) => option.value === event.target.value,
      );
      if (chosen) onChange(chosen.value);
    }}
  >
    {options.map((option) => (
      <option
        key={option.value}
        value={option.value}
        disabled={option.disabled}
      >
        {option.label}
      </option>
    ))}
  </select>
);
