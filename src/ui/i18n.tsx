import { createContext, useContext, useMemo } from "react";
import { assessmentInfo } from "../core/assessments";
import type { Assessment } from "../core/model";
import { es } from "./es";

/**
 * The portal's language follows the assessment: SAT is English, PAA is Spanish.
 * Screens write their text in English and pass it through `t`; the PAA portal
 * looks the same text up in the Spanish table (`es.ts`) and falls back to the
 * English if a line has no translation yet. `{name}` marks a value to insert.
 */
const AssessmentContext = createContext<Assessment>("SAT");
export const AssessmentProvider = AssessmentContext.Provider;
export const useAssessment = () => useContext(AssessmentContext);

export type Translate = (
  text: string,
  values?: Record<string, string | number>,
) => string;

export function translator(assessment: Assessment): Translate {
  const table = assessmentInfo(assessment).language === "es" ? es : undefined;
  return (text, values) => {
    const line = table?.[text] ?? text;
    return values
      ? line.replace(/\{(\w+)\}/g, (match, name: string) =>
          name in values ? String(values[name]) : match,
        )
      : line;
  };
}

export function useT(): Translate {
  const assessment = useAssessment();
  return useMemo(() => translator(assessment), [assessment]);
}
