import { useEffect, useRef, useState } from "react";
import { clamp } from "@/src/utils/calculator";
import { readStorage, writeStorage } from "@/src/utils/storage";

const key = "sat-study-calculator-split";
export function useCalculatorSplit() {
  const body = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => {
    const saved = Number(readStorage(key));
    return saved >= 0.15 && saved <= 0.85 ? saved : 0.39;
  });
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (body.current) observer.observe(body.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    writeStorage(key, String(ratio));
  }, [ratio]);
  // Keep both panels useful, but keep the preferred ratio for larger windows.
  const current = clamp(width * ratio, 230, width - 248);
  return { body, ratio: current / width, setRatio, width };
}

export function SplitDivider({
  ratio,
  width,
  onChange,
}: {
  ratio: number;
  width: number;
  onChange: (ratio: number) => void;
}) {
  const origin = useRef<{ x: number; ratio: number } | undefined>(undefined);
  const adjust = (value: number) =>
    onChange(clamp(value, 230 / width, (width - 248) / width));
  return (
    <div
      className="calc-split-divider"
      role="separator"
      aria-label="Expression and graph divider"
      aria-orientation="vertical"
      aria-valuemin={Math.round((230 / width) * 100)}
      aria-valuemax={Math.round(((width - 248) / width) * 100)}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        origin.current = { x: event.clientX, ratio };
      }}
      onPointerMove={(event) => {
        if (origin.current)
          adjust(
            origin.current.ratio + (event.clientX - origin.current.x) / width,
          );
      }}
      onPointerUp={() => {
        origin.current = undefined;
      }}
      onPointerCancel={() => {
        origin.current = undefined;
      }}
      onLostPointerCapture={() => {
        origin.current = undefined;
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        adjust(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 1
              : ratio +
                (event.key === "ArrowRight" ? 1 : -1) *
                  (event.shiftKey ? 0.1 : 0.02),
        );
      }}
    />
  );
}
