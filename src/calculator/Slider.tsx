import { useEffect, useRef, useState } from "react";
import type { SliderSettings } from "./model";
import { defaultSlider, validSlider } from "./model";

type Mode = "bounce" | "loop" | "once";
const SPEEDS = [0.25, 0.5, 1, 2, 4];
/** At normal speed the value sweeps its whole range in this many seconds. */
const SWEEP_SECONDS = 8;
const TICK_MS = 50;

/** Rounds to the slider's step and removes floating-point dust (0.30000000000000004). */
const snap = (value: number, { min, step }: SliderSettings) =>
  Number((Math.round((value - min) / step) * step + min).toPrecision(12));

/**
 * A slider for a number the person defined (a=2): drag it, set its range and
 * step, or press play to watch the graph change as the value moves.
 */
export function Slider({
  name,
  value,
  settings,
  onValue,
  onSettings,
}: {
  name: string;
  value: number;
  settings?: SliderSettings;
  onValue: (value: number) => void;
  onSettings: (settings: SliderSettings) => void;
}) {
  const range = settings ?? defaultSlider(value);
  // A value typed outside the range widens the track so the handle stays visible.
  const track = {
    ...range,
    min: Math.min(range.min, value),
    max: Math.max(range.max, value),
  };
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<Mode>("bounce");
  const [open, setOpen] = useState(false);
  const latest = useRef({ value, range: track, onValue, speed, mode });
  latest.current = { value, range: track, onValue, speed, mode };
  const position = useRef(value);
  const direction = useRef(1);

  useEffect(() => {
    if (!playing) return;
    position.current = latest.current.value;
    const timer = setInterval(() => {
      const {
        value: shown,
        range: r,
        onValue: send,
        speed: rate,
        mode: how,
      } = latest.current;
      // Someone typed a different value while it played: carry on from there.
      if (Math.abs(position.current - shown) > r.step * 1.5)
        position.current = shown;
      const delta = ((r.max - r.min) / SWEEP_SECONDS) * (TICK_MS / 1000) * rate;
      // Repeat always counts upward and starts over at the minimum, even when
      // it was switched on while the value was on its way down.
      if (how === "loop") direction.current = 1;
      let next = position.current + delta * direction.current;
      if (next >= r.max || next <= r.min) {
        if (how === "bounce") {
          direction.current = next >= r.max ? -1 : 1;
        } else if (how === "loop") {
          next =
            next >= r.max ? r.min + ((next - r.min) % (r.max - r.min)) : r.min;
        } else setPlaying(false);
      }
      next = Math.min(r.max, Math.max(r.min, next));
      position.current = next;
      const snapped = snap(next, r);
      if (snapped !== shown) send(snapped);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const bound = (key: "min" | "max" | "step", label: string) => (
    <SettingInput
      key={key}
      label={`${name} slider ${label}`}
      value={range[key]}
      onCommit={(number) => {
        const next = { ...range, [key]: number };
        if (validSlider(next)) onSettings(next);
        return validSlider(next);
      }}
    />
  );

  return (
    <div className="calc-slider">
      <div className="calc-slider-track">
        {bound("min", "minimum")}
        <input
          aria-label={`${name} slider`}
          type="range"
          min={track.min}
          max={track.max}
          step={track.step}
          value={value}
          onPointerDown={() => setPlaying(false)}
          // "input" fires while dragging; the later "change" would repeat it
          // with a value the browser has snapped to the step.
          onInput={(event) => onValue(event.currentTarget.valueAsNumber)}
          onChange={() => {}}
        />
        {bound("max", "maximum")}
        <button
          type="button"
          className="calc-slider-play"
          aria-label={`${playing ? "Pause" : "Play"} ${name} slider`}
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className="calc-slider-more"
          aria-label={`${name} slider settings`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          ⋯
        </button>
      </div>
      {open && (
        <div className="calc-slider-settings">
          <label>
            Step
            {bound("step", "step")}
          </label>
          <label>
            Speed
            <select
              aria-label={`${name} slider speed`}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <label>
            Animation
            <select
              aria-label={`${name} slider animation`}
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="bounce">Back and forth</option>
              <option value="loop">Repeat</option>
              <option value="once">Once</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/** A number field that keeps what is typed until it is a valid setting. */
function SettingInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => boolean;
}) {
  const [text, setText] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <input
      className="calc-slider-bound"
      aria-label={label}
      aria-invalid={invalid}
      type="number"
      step="any"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const number = event.target.valueAsNumber;
        setInvalid(!Number.isFinite(number) || !onCommit(number));
      }}
    />
  );
}
