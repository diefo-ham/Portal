import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { CalculatorState } from "./model";
import {
  clampGeometry,
  defaultGeometry,
  geometryKey,
  readGeometry,
  type WindowGeometry,
} from "./windowGeometry";
import "./layout.css";
const Surface = lazy(() => import("./CalculatorSurface"));
const viewport = () => ({
  width: Math.min(
    document.body.clientWidth,
    document.documentElement.clientWidth,
  ),
  height: window.innerHeight,
});

export function CalculatorPanel({
  state,
  onChange,
  onClose,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  onClose: () => void;
}) {
  const [geometry, setGeometry] = useState(() => readGeometry(viewport()));
  const [narrow, setNarrow] = useState(() => innerWidth < 620);
  const [moving, setMoving] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    geometry: WindowGeometry;
    kind: string;
  } | null>(null);
  const set = (g: WindowGeometry) => setGeometry(clampGeometry(g, viewport()));
  useEffect(() => {
    const resize = () => {
      const constrained = innerWidth < 620;
      setNarrow(constrained);
      // The phone overlay ignores desktop geometry; keep the last useful size
      // for returning to a larger window instead of saving phone dimensions.
      if (!constrained) setGeometry((g) => clampGeometry(g, viewport()));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (narrow || moving) return;
    try {
      localStorage.setItem(geometryKey, JSON.stringify(geometry));
    } catch {
      /* Optional preference. */
    }
  }, [geometry, narrow, moving]);
  const start = (e: PointerEvent<HTMLElement>, kind: string) => {
    if (narrow || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, geometry, kind };
    setMoving(true);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    set(
      d.kind === "move"
        ? { ...d.geometry, x: d.geometry.x + dx, y: d.geometry.y + dy }
        : {
            ...d.geometry,
            width: d.geometry.width + (d.kind.includes("e") ? dx : 0),
            height: d.geometry.height + (d.kind.includes("s") ? dy : 0),
          },
    );
  };
  const stop = () => {
    drag.current = null;
    setMoving(false);
  };
  const keyboardGeometry = (event: KeyboardEvent, kind: string) => {
    if (!event.key.startsWith("Arrow") || narrow) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    const dx =
      event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy =
      event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    set(
      kind === "move"
        ? { ...geometry, x: geometry.x + dx, y: geometry.y + dy }
        : {
            ...geometry,
            width: geometry.width + dx,
            height: geometry.height + dy,
          },
    );
  };
  return createPortal(
    <aside
      className={`calculator-sheet ${moving ? "window-moving" : ""}`}
      aria-label="Calculator panel"
      role="dialog"
      aria-modal="false"
      style={
        narrow
          ? undefined
          : {
              left: geometry.x,
              top: geometry.y,
              width: geometry.width,
              height: geometry.height,
            }
      }
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" && !(e.target instanceof HTMLSelectElement)) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <header className="calc-window-heading">
        <div
          className="calc-drag-handle"
          tabIndex={0}
          role="button"
          aria-label="Move calculator"
          aria-describedby="calculator-window-help"
          onPointerDown={(e) => start(e, "move")}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onKeyDown={(e) => keyboardGeometry(e, "move")}
        >
          <h2>Calculator</h2>
        </div>
        <button
          className="text-button"
          aria-label="Reset calculator window"
          title="Restore default size and position"
          onClick={() => set(defaultGeometry(viewport()))}
        >
          Reset window
        </button>
        <button aria-label="Close calculator" onClick={onClose}>
          ×
        </button>
      </header>
      <span id="calculator-window-help" className="sr-only">
        Drag the title to move. Use arrow keys on the title or resize handles;
        hold Shift for larger steps. Reset window restores the size and
        position.
      </span>
      <Suspense fallback={<p className="small muted">Opening calculator…</p>}>
        <Surface state={state} onChange={onChange} />
      </Suspense>
      {!narrow &&
        (
          [
            ["e", "Resize calculator width"],
            ["s", "Resize calculator height"],
            ["se", "Resize calculator"],
          ] as const
        ).map(([kind, label]) => (
          <div
            key={kind}
            className={`calc-resize calc-resize-${kind}`}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-describedby="calculator-window-help"
            onPointerDown={(e) => start(e, kind)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={(e) => keyboardGeometry(e, "resize")}
          />
        ))}
    </aside>,
    document.body,
  );
}
