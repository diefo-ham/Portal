import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * What the person sees when a screen fails to draw, instead of a blank page.
 * Study data is saved on this device as it changes, so the page says that
 * nothing was lost, offers a way out, and keeps the technical details one click
 * away (and copyable) so a problem can be reported.
 *
 * It sits above the language provider, so it reads the page's language, which
 * the app keeps in step with the test being studied (Spanish for the PAA).
 */

const TEXT = {
  en: {
    eyebrow: "SOMETHING WENT WRONG",
    heading: "This screen could not be shown.",
    body: "Your answers and progress are saved on this device. Going back to the start usually fixes it; if it happens again, copy the details below and send them along.",
    home: "Back to the start",
    reload: "Reload the page",
    details: "Technical details",
    copy: "Copy details",
    copied: "Copied",
  },
  es: {
    eyebrow: "ALGO SALIÓ MAL",
    heading: "No se pudo mostrar esta pantalla.",
    body: "Tus respuestas y tu progreso están guardados en este dispositivo. Volver al inicio suele resolverlo; si vuelve a pasar, copia los detalles de abajo y envíalos.",
    home: "Volver al inicio",
    reload: "Recargar la página",
    details: "Detalles técnicos",
    copy: "Copiar los detalles",
    copied: "Copiado",
  },
} as const;

const language = () =>
  typeof document !== "undefined" && document.documentElement.lang === "es"
    ? "es"
    : "en";

/** The error as plain text a person can copy into a message. */
export function describeError(error: unknown, componentStack?: string | null) {
  const own =
    error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`
      : String(error);
  return [
    own,
    componentStack ? `Component stack:${componentStack}` : "",
    `Address: ${typeof location === "undefined" ? "" : location.href}`,
    `Browser: ${typeof navigator === "undefined" ? "" : navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface Props {
  children: ReactNode;
  /** Called by "Back to the start", after the failed screen is cleared. */
  onHome?: () => void;
}
interface State {
  error?: unknown;
  stack?: string | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { copied: false };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error("Unknown error"), copied: false };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ stack: info.componentStack });
    // Kept in the console as well, for anyone with the developer tools open.
    console.error("Screen failed to render", error, info.componentStack);
  }

  private home = () => {
    this.setState({ error: undefined, stack: undefined, copied: false });
    if (this.props.onHome) this.props.onHome();
    else {
      location.hash = "";
      location.reload();
    }
  };

  private copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
    } catch {
      /* the details stay on screen to select by hand */
    }
  };

  render() {
    if (this.state.error === undefined) return this.props.children;
    const t = TEXT[language()];
    const details = describeError(this.state.error, this.state.stack);
    return (
      <main className="page narrow error-page" role="alert">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.heading}</h1>
        <p className="muted">{t.body}</p>
        <div className="error-actions">
          <button className="primary" onClick={this.home}>
            {t.home}
          </button>
          <button onClick={() => location.reload()}>{t.reload}</button>
        </div>
        <details>
          <summary>{t.details}</summary>
          <pre className="error-details" tabIndex={0}>
            {details}
          </pre>
          <button onClick={() => void this.copy(details)}>
            {this.state.copied ? t.copied : t.copy}
          </button>
        </details>
      </main>
    );
  }
}
