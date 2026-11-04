// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssessmentProvider, translator } from "../i18n";
import { AppFooter } from "./AppFooter";

afterEach(cleanup);

describe("AppFooter", () => {
  it("states the purpose and that it is not affiliated with College Board", () => {
    render(<AppFooter />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(
      screen.getByText("Made for focused, independent study."),
    ).toBeTruthy();
    expect(
      screen.getByText("Personal practice · Not affiliated with College Board"),
    ).toBeTruthy();
  });

  it("is in Spanish for the PAA", () => {
    const t = translator("PAA");
    render(
      <AssessmentProvider value="PAA">
        <AppFooter />
      </AssessmentProvider>,
    );
    expect(
      screen.getByText(t("Made for focused, independent study.")),
    ).toBeTruthy();
  });
});
