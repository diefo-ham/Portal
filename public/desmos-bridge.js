// Only the documented hosted API is loaded. No question/session metadata enters this frame.
let calculator;
const send = (type, extra = {}) =>
  parent.postMessage({ source: "sat-desmos", type, ...extra }, location.origin);
window.addEventListener("message", (event) => {
  if (
    event.source !== parent ||
    event.origin !== location.origin ||
    event.data?.source !== "sat-calculator"
  )
    return;
  const message = event.data;
  if (
    message.type === "init" &&
    !calculator &&
    !document.querySelector("script[data-desmos]")
  ) {
    const script = document.createElement("script");
    script.dataset.desmos = "true";
    script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(message.key)}`;
    script.onload = () => {
      try {
        calculator = Desmos.GraphingCalculator(
          document.getElementById("calculator"),
          {
            autosize: true,
            border: false,
            fontSize: 16,
            images: false,
            pasteGraphLink: false,
            links: false,
            showReducedMotionCover: true,
            pointsOfInterest: true,
            trace: true,
            customRegressions: true,
          },
        );
        if (message.state) calculator.setState(message.state);
        calculator.observeEvent("change", () =>
          send("state", { state: calculator.getState() }),
        );
        send("ready");
        calculator.focusFirstExpression();
      } catch {
        send("error");
      }
    };
    script.onerror = () => send("error");
    document.head.appendChild(script);
  }
  if (message.type === "clear" && calculator) {
    calculator.setBlank();
    send("state", { state: calculator.getState() });
    calculator.focusFirstExpression();
  }
  if (message.type === "snapshot" && calculator)
    send("state", { state: calculator.getState() });
});
window.addEventListener("pagehide", () => {
  if (calculator) calculator.destroy();
});
send("bridge-ready");
