import { useEffect, useRef } from "react";
import {
  MathField,
  bundledLocalize,
  type MathFieldApi,
} from "../../vendor/desquill/desquill.js";
import "../../vendor/desquill/desquill.css";
import { latexToText, textToLatex } from "./latex";

export function focusMath(id: string) {
  document
    .getElementById(`expression-${id}`)
    ?.querySelector<HTMLTextAreaElement>("textarea")
    ?.focus();
  document.getElementById(`cell-${id}-0-0`)?.focus();
}

export function MathEditor({
  id,
  label,
  text,
  latex,
  invalid,
  onChange,
  onEnter,
  onRemove,
  onMove,
  onTable,
}: {
  id: string;
  label: string;
  text: string;
  latex?: string;
  invalid: boolean;
  onChange: (text: string, latex: string) => void;
  onEnter: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onTable: () => void;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const api = useRef<MathFieldApi | undefined>(undefined);
  const props = useRef({ onChange, onEnter, onRemove, onMove, onTable });
  props.current = { onChange, onEnter, onRemove, onMove, onTable };
  const lastText = useRef(text);
  const syncing = useRef(false);
  useEffect(() => {
    const element = document.createElement("span");
    host.current!.appendChild(element);
    const field = MathField(element, {
      localize: bundledLocalize,
      autoCommands: "sqrt nthroot pi theta cbrt",
      autoOperatorNames:
        "sin cos tan sec csc cot asin acos atan arcsin arccos arctan arcsec arccsc arccot log ln exp abs floor ceil round sign gcd lcm mod nCr nPr min max mean median quartile quantile stdev stdevp var varp variance mad count total stats table",
      prefixOperatorNames: "sin cos tan sec csc cot log ln abs",
      typingPercentWritesPercentOf: true,
      leftRightIntoCmdGoes: "up",
      autoSubscriptNumerals: true,
      charsThatBreakOutOfSupSub: "+-=<>~",
      supSubsRequireOperand: true,
      restrictMismatchedBrackets: "none",
      scrollAnimationDuration: 0,
      maxDepth: 24,
      overrideKeystroke: (key: string, event: KeyboardEvent) => {
        // Leave Shift+Backslash to the native text-input path so DesQuill
        // receives the resulting pipe used for absolute-value delimiters.
        if (
          event.code === "Backslash" &&
          event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        )
          return;
        if (key === "Enter") {
          event.preventDefault();
          props.current.onEnter();
          return;
        }
        if ((key === "Backspace" || key === "Del") && !field.latex().trim()) {
          event.preventDefault();
          props.current.onRemove();
          return;
        }
        if (key === "Up" || key === "Down") {
          const before = field.selection();
          field.keystroke(key, event);
          const after = field.selection();
          if (
            before.startIndex === after.startIndex &&
            before.endIndex === after.endIndex
          )
            props.current.onMove(key === "Up" ? -1 : 1);
          return;
        }
        field.keystroke(key, event);
      },
    });
    api.current = field;
    field.latex(latex ?? textToLatex(text));
    field.setAriaLabel(label);
    let lastValue = field.latex();
    const stop = field.subscribeToChanges(() => {
      const value = field.latex();
      if (syncing.current) {
        lastValue = value;
        return;
      }
      if (value === lastValue) return;
      let source: string;
      try {
        source = latexToText(value);
      } catch {
        source = "?";
      }
      if (value.length > 1500 || source.length > 1200) {
        syncing.current = true;
        field.latex(lastValue);
        field.setAriaPostLabel("Expression length limit reached.");
        syncing.current = false;
        return;
      }
      lastValue = value;
      if (source === "table" || source === "t*a*b*l*e") {
        props.current.onTable();
        return;
      }
      lastText.current = source;
      props.current.onChange(source, value);
    });
    // DesQuill accepts LaTeX on paste; plain math remains a useful entry path.
    const paste = (event: ClipboardEvent) => {
      const value = event.clipboardData?.getData("text/plain");
      if (!value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (value.includes("\\")) field.write(value);
      else field.write(textToLatex(value));
    };
    element.addEventListener("paste", paste, true);
    return () => {
      stop();
      field.blur();
      element.remove();
      api.current = undefined;
    };
  }, [id]);
  useEffect(() => {
    api.current?.setAriaLabel(label);
    const textarea = host.current?.querySelector("textarea");
    if (textarea) {
      const speech = textarea.getAttribute("aria-labelledby");
      if (speech) {
        textarea.setAttribute("aria-describedby", speech);
        textarea.removeAttribute("aria-labelledby");
      }
      textarea.setAttribute("aria-label", label);
      textarea.setAttribute("aria-invalid", String(invalid));
    }
  }, [label, invalid]);
  useEffect(() => {
    if (text !== lastText.current) {
      syncing.current = true;
      api.current?.latex(latex ?? textToLatex(text));
      syncing.current = false;
      lastText.current = text;
    }
  }, [text, latex]);
  return (
    <span
      id={`expression-${id}`}
      className="calc-structural-input"
      ref={host}
      data-latex={latex ?? textToLatex(text)}
      data-source={text}
    />
  );
}
