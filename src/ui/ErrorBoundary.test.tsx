// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary, describeError } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
  vi.restoreAllMocks();
});

const Boom = (): never => {
  throw new Error("Esto falló al dibujar");
};

describe("ErrorBoundary", () => {
  it("shows its children when nothing fails", () => {
    render(
      <ErrorBoundary>
        <p>Todo bien</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Todo bien")).toBeTruthy();
  });

  it("replaces a failed screen with an error page that says what failed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("heading", { name: "This screen could not be shown." }),
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Esto falló al dibujar/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Back to the start" }),
    ).toBeTruthy();
  });

  it("is written in Spanish for the PAA portal", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.documentElement.lang = "es";
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("heading", {
        name: "No se pudo mostrar esta pantalla.",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Volver al inicio" }),
    ).toBeTruthy();
  });

  it("goes back to the start and shows the app again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    const Maybe = () => {
      if (broken) throw new Error("x");
      return <p>De vuelta</p>;
    };
    const onHome = vi.fn(() => {
      broken = false;
    });
    render(
      <ErrorBoundary onHome={onHome}>
        <Maybe />
      </ErrorBoundary>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Back to the start" }),
    );
    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.getByText("De vuelta")).toBeTruthy();
  });

  it("copies the details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await user.click(screen.getByText("Technical details"));
    await user.click(screen.getByRole("button", { name: "Copy details" }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("Esto falló al dibujar");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});

describe("describeError", () => {
  it("handles things that are not errors", () => {
    expect(describeError("texto")).toContain("texto");
    expect(describeError(undefined)).toContain("undefined");
  });
});
