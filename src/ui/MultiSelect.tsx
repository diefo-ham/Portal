import { useEffect, useId, useRef, useState } from "react";
import type { TaxonomyOption } from "../core/taxonomy";
export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: TaxonomyOption[];
  value: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const names = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);
  return (
    <div
      className="multi-select"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !root.current?.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <span id={`${id}-label`} className="filter-label">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        title={names.join(", ") || "Any"}
        aria-label={`${label}: ${value.length ? `${value.length} selected` : "Any"}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
      >
        <span>
          {value.length === 0
            ? `Any ${label.toLowerCase()}`
            : value.length === 1
              ? names[0] || "1 selected"
              : `${value.length} selected`}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-labelledby={`${id}-label`}
          className="multi-options"
        >
          {options.length > 8 && (
            <input
              aria-label={`Find ${label.toLowerCase()}`}
              placeholder="Find…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          <div className="multi-option-list">
            {options
              .filter((option) =>
                option.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...value, option.value]
                          : value.filter((key) => key !== option.value),
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            {!options.length && (
              <p className="muted small">No skills in this selection.</p>
            )}
          </div>
          <div className="multi-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => onChange([])}
            >
              Clear {label.toLowerCase()}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
