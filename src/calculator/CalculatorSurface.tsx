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
  autoFocus = true,
}: {
  state: CalculatorState;
  onChange: (state: CalculatorState) => void;
  autoFocus?: boolean;
}) {
  const [apiKey, setApiKey] = useState(
    (import.meta.env.VITE_DESMOS_API_KEY || "").trim(),
  );
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  // Explicit Offline choice persists. Otherwise configured Desmos is primary.
  const desired = state.mode ?? (apiKey ? "desmos" : "offline");
  const connecting = desired === "desmos" && !!apiKey && !failed;
  const frame = useRef<HTMLIFrameElement>(null);
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
    // Local configuration only; never a connectivity probe.
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
    if (!connecting) return;
    setReady(false);
    const timeout = setTimeout(
      () =>
        setFailed(
          "Desmos did not respond. Try again when connected, or use Offline.",
        ),
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
        setFailed(
          "Desmos is unavailable. Try again when connected, or use Offline.",
        );
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
    // A loaded calculator may continue working without connectivity. Do not destroy it.
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [connecting, apiKey, retry]);
  const switchMode = (mode: "offline" | "desmos") => {
    if (mode === desired && ready && !failed) return;
    setReady(false);
    setFailed("");
    onChange({ ...latest.current, mode });
    if (mode === "desmos") setRetry((value) => value + 1);
  };
  const clear = () => {
    if (desired === "desmos") {
      if (ready) post("clear");
      return;
    }
    onChange({ ...emptyCalculator(), mode: "offline", desmos: state.desmos });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".offline-workspace textarea")
        ?.focus(),
    );
  };
  return (
    <section
      className="calculator-workspace calculator-surface"
      aria-label="Calculator workspace"
    >
      <div className="calc-provider-bar">
        <div role="group" aria-label="Calculator engine">
          <button
            aria-pressed={desired === "desmos"}
            title="Official online calculator"
            onClick={() => switchMode("desmos")}
          >
            Desmos
          </button>
          <button
            aria-pressed={desired === "offline"}
            title="Local fallback; no internet needed"
            onClick={() => switchMode("offline")}
          >
            Offline
          </button>
        </div>
        <button
          className="text-button"
          disabled={desired === "desmos" && !ready}
          onClick={clear}
        >
          Clear calculator
        </button>
      </div>
      {desired === "desmos" ? (
        <>
          {!apiKey || failed ? (
            <div className="calc-provider-status" role="status">
              <p>
                {failed ||
                  "Desmos needs an API key. Offline is available without one."}
              </p>
              {apiKey && (
                <button onClick={() => switchMode("desmos")}>
                  Retry Desmos
                </button>
              )}
              <button
                className="text-button"
                onClick={() => switchMode("offline")}
              >
                Use Offline
              </button>
            </div>
          ) : (
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
          )}
        </>
      ) : (
        <Calculator state={state} onChange={onChange} autoFocus={autoFocus} />
      )}
    </section>
  );
}
export default CalculatorSurface;
