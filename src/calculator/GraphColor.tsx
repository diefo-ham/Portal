import { useEffect, useRef, useState } from "react";
const colors = [
  "Moss",
  "Blue",
  "Terracotta",
  "Plum",
  "Ochre",
  "Teal",
  "Rose",
  "Slate",
];
export function GraphColor({
  hidden,
  color,
  label,
  onToggle,
  onColor,
}: {
  hidden: boolean;
  color: number;
  label: string;
  onToggle: () => void;
  onColor: (color: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPress = useRef(false);
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => clear, []);
  return (
    <span
      className="calc-color-control"
      ref={root}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          event.preventDefault();
          setOpen(false);
          root.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        className="calc-visibility"
        aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
        aria-pressed={!hidden}
        aria-description="Right click, long press, or press Shift+Enter to choose a color."
        title="Click to show/hide · right click or Shift+Enter for color"
        onClick={() => {
          if (longPress.current) longPress.current = false;
          else onToggle();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          clear();
          setOpen(true);
        }}
        onPointerDown={() => {
          longPress.current = false;
          timer.current = setTimeout(() => {
            longPress.current = true;
            setOpen(true);
          }, 500);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onKeyDown={(event) => {
          if (
            (event.key === "F10" && event.shiftKey) ||
            (event.key === "Enter" && event.shiftKey)
          ) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(!open);
          }
        }}
      >
        {hidden ? "○" : "●"}
      </button>
      {open && (
        <div
          className="calc-color-menu"
          role="group"
          aria-label={`Color for ${label}`}
        >
          {colors.map((name, index) => (
            <button
              key={name}
              className={`graph-color-${index}`}
              aria-label={name}
              aria-pressed={color % 8 === index}
              onClick={() => {
                onColor(index);
                setOpen(false);
                root.current?.querySelector("button")?.focus();
              }}
            >
              ●
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
