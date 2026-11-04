import { describe, expect, it } from "vitest";
import { backfillAssessments } from "../src/core/assessments";
import { emptyData, type Question } from "../src/core/model";
import {
  PAA_SKILL_GROUPS,
  coarsePaaSkill,
  groupPaaSkill,
} from "../src/core/paaTaxonomy";

const question = (skill: string, domain = "Álgebra"): Question => ({
  id: "paa-1",
  assessment: "PAA",
  section: "matematicas",
  domain,
  skill,
  stem: "x",
  testStatus: "unknown",
  answer: { type: "choice", value: "A" },
});

describe("PAA skill grouping", () => {
  it("keeps every grouped skill under its own domain and uses each label once", () => {
    for (const [section, domains] of Object.entries(PAA_SKILL_GROUPS))
      for (const [domain, skills] of Object.entries(domains)) {
        const seen = new Set<string>();
        for (const [coarse, fine] of Object.entries(skills)) {
          expect(fine.length, `${domain} / ${coarse}`).toBeGreaterThan(0);
          for (const label of fine) {
            expect(seen.has(label), `${domain}: ${label} listed twice`).toBe(
              false,
            );
            seen.add(label);
            expect(coarsePaaSkill(section, domain, label)).toBe(coarse);
          }
        }
      }
  });

  it("is stable: a grouped label stays as it is", () => {
    for (const [section, domains] of Object.entries(PAA_SKILL_GROUPS))
      for (const [domain, skills] of Object.entries(domains))
        for (const coarse of Object.keys(skills))
          expect(coarsePaaSkill(section, domain, coarse)).toBe(coarse);
  });

  it("groups by domain, so one label can mean two things", () => {
    expect(
      coarsePaaSkill(
        "ingles",
        "Comprensión de lectura",
        "Vocabulario en contexto",
      ),
    ).toBe("Idea principal y vocabulario");
    expect(
      coarsePaaSkill(
        "ingles",
        "Uso del lenguaje y vocabulario",
        "Vocabulario en contexto",
      ),
    ).toBe("Vocabulario");
  });

  it("ignores case, spacing and the space a wrapped hyphen leaves", () => {
    expect(
      coarsePaaSkill(
        "ingles",
        "Redacción indirecta",
        "Concordancia sujeto- verbo",
      ),
    ).toBe("Gramática y puntuación");
    expect(
      coarsePaaSkill("matematicas", "álgebra", "  pendiente  de una recta"),
    ).toBe("Rectas y funciones");
  });

  it("leaves a skill it does not know, and Redacción, alone", () => {
    expect(coarsePaaSkill("matematicas", "Álgebra", "Logaritmos")).toBe(
      "Logaritmos",
    );
    expect(
      coarsePaaSkill(
        "redaccion",
        "Adición",
        "Enriquecer estilísticamente una secuencia",
      ),
    ).toBe("Enriquecer estilísticamente una secuencia");
  });

  it("keeps the original label as detail, once", () => {
    const grouped = groupPaaSkill(question("Pendiente de una recta"));
    expect(grouped.skill).toBe("Rectas y funciones");
    expect(grouped.skillDetail).toBe("Pendiente de una recta");
    expect(groupPaaSkill(grouped)).toBe(grouped);
    const unchanged = question("Logaritmos");
    expect(groupPaaSkill(unchanged)).toBe(unchanged);
  });

  it("is applied to a bank saved before skills were grouped", () => {
    const data = emptyData();
    data.questions = [
      question("Pendiente de una recta"),
      {
        ...question("Inferencia", "Análisis, interpretación e inferencias"),
        id: "paa-2",
        section: "lectura",
      },
    ];
    backfillAssessments(data);
    expect(data.questions[0].skill).toBe("Rectas y funciones");
    expect(data.questions[0].skillDetail).toBe("Pendiente de una recta");
    expect(data.questions[1].skill).toBe("Inferencia");
    expect(data.questions[1].skillDetail).toBeUndefined();
    // A second read changes nothing.
    backfillAssessments(data);
    expect(data.questions[0].skillDetail).toBe("Pendiente de una recta");
  });
});
