import { useEffect, useRef, useState } from "react";
import { Calculator } from "./Calculator";
import {
  emptyCalculator,
  validateDesmosState,
  type CalculatorState,
} from "./model";
import "./calculator.css";

export function CalculatorSurface({
  state,
  onChange,
  onClose,
  expanded,
  onExpand,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  onClose: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const [apiKey, setApiKey] = useState(
    (import.meta.env.VITE_DESMOS_API_KEY || "").trim(),
  );
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const desired = state.mode ?? (apiKey ? "desmos" : "offline");
  const online = desired === "desmos" && !!apiKey && !failed;
  const frame = useRef<HTMLIFrameElement>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(state);
  latest.current = state;
  const change = useRef(onChange);
  change.current = onChange;
  const post = (type: string, extra = {}) =>
    frame.current?.contentWindow?.postMessage(
      { source: "sat-calculator", type, ...extra },
      location.origin,
    );
  useEffect(() => {
    if (apiKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    void fetch("/calculator-config.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((config) => {
        if (
          typeof config?.desmosApiKey === "string" &&
          config.desmosApiKey.length < 500
        )
          setApiKey(config.desmosApiKey.trim());
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    setReady(false);
    const timeout = setTimeout(
      () =>
        setFailed("Desmos did not respond. Your Offline workspace is ready."),
      6500,
    );
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== location.origin ||
        event.data?.source !== "sat-desmos"
      )
        return;
      const message = event.data;
      if (message.type === "bridge-ready")
        post("init", { key: apiKey, state: latest.current.desmos });
      if (message.type === "ready") {
        clearTimeout(timeout);
        setReady(true);
      }
      if (message.type === "error") {
        clearTimeout(timeout);
        setFailed("Desmos is unavailable. Your Offline workspace is ready.");
      }
      if (message.type === "state") {
        try {
          change.current({
            ...latest.current,
            desmos: validateDesmosState(message.state),
          });
        } catch {
          setFailed(
            "Desmos work could not be saved safely. Your previous saved work is retained.",
          );
        }
      }
    };
    window.addEventListener("message", receive);
    const disconnected = () =>
      setFailed(
        "Connection lost. Your saved Desmos work is retained; Offline is ready.",
      );
    window.addEventListener("offline", disconnected);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      window.removeEventListener("offline", disconnected);
    };
  }, [online, apiKey, retry]);
  const switchMode = (mode: "offline" | "desmos") => {
    setConfirmClear(false);
    setReady(false);
    setFailed("");
    onChange({ ...latest.current, mode });
    if (mode === "desmos") setRetry((value) => value + 1);
  };
  return (
    <section
      className={`calculator-workspace calculator-surface ${expanded ? "expanded" : ""}`}
      aria-label="Calculator workspace"
    >
      <div className="calc-heading">
        <h2>Calculator</h2>
        <div>
          <button
            aria-label={expanded ? "Reduce calculator" : "Expand calculator"}
            onClick={onExpand}
          >
            {expanded ? "Reduce ↙" : "Expand ↗"}
          </button>
          <button aria-label="Close calculator" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="calc-provider-bar">
        <div role="group" aria-label="Calculator engine">
          <button
            aria-pressed={online}
            disabled={!apiKey}
            title={
              !apiKey
                ? "A Desmos API key is not configured."
                : "Official online calculator"
            }
            onClick={() => switchMode("desmos")}
          >
            Desmos
          </button>
          <button aria-pressed={!online} onClick={() => switchMode("offline")}>
            Offline
          </button>
        </div>
        <button
          ref={clearButton}
          className="text-button"
          onClick={() => setConfirmClear(true)}
        >
          Clear calculator
        </button>
      </div>
      {confirmClear && (
        <div
          className="calc-clear-confirm"
          role="group"
          aria-label="Clear calculator confirmation"
        >
          <span>Clear this {online ? "Desmos" : "Offline"} workspace?</span>
          <button
            onClick={() => {
              if (online && ready) post("clear");
              else
                onChange({
                  ...emptyCalculator(),
                  mode: state.mode,
                  desmos: state.desmos,
                });
              setConfirmClear(false);
              if (!online)
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(".offline-workspace textarea")
                    ?.focus(),
                );
            }}
            disabled={online && !ready}
          >
            Clear
          </button>
          <button
            onClick={() => {
              setConfirmClear(false);
              clearButton.current?.focus();
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {online ? (
        <>
          {!ready && (
            <p className="calc-provider-status" role="status">
              Connecting to Desmos…{" "}
              <button
                className="text-button"
                onClick={() => switchMode("offline")}
              >
                Use Offline now
              </button>
            </p>
          )}
          <iframe
            key={retry}
            ref={frame}
            className={`desmos-frame ${ready ? "ready" : ""}`}
            title="Official Desmos graphing calculator"
            src="/desmos.html"
            onLoad={() =>
              post("init", { key: apiKey, state: latest.current.desmos })
            }
          />
        </>
      ) : (
        <>
          {(failed || (desired === "desmos" && !apiKey)) && (
            <p className="calc-provider-status" role="status">
              {failed || "No Desmos API key configured. Using Offline."}
              {apiKey && (
                <button
                  className="text-button"
                  onClick={() => switchMode("desmos")}
                >
                  Retry Desmos
                </button>
              )}
            </p>
          )}
          <Calculator
            state={state}
            onChange={(next) =>
              onChange(
                online
                  ? next
                  : {
                      ...next,
                      ...(failed ? {} : { mode: "offline" as const }),
                    },
              )
            }
          />
        </>
      )}
    </section>
  );
}
export default CalculatorSurface;
