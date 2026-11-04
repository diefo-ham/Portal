import type { Question } from "./model";

/**
 * The PAA bank labels almost every question with a skill of its own (97 skills
 * for 154 questions, 72 of them used once), which makes the skill filter and the
 * per-skill results useless. Skills are grouped under the domains the bank
 * already uses; the original label is kept as `skillDetail`. A label that is not
 * listed here stays as it is, so a new bank never loses a skill.
 *
 * Domains are not changed. Redacción has one skill per domain already.
 */
const GROUPS: Record<string, Record<string, Record<string, string[]>>> = {
  lectura: {
    "Análisis de información cuantitativa o de gráficos": {
      "Tablas y gráficas": [
        "Lectura de tablas",
        "Lectura de gráficas",
        "Cálculo con datos de una gráfica",
        "Porcentaje con datos de una gráfica",
      ],
    },
    "Análisis literario": {
      "Género y recursos literarios": [
        "Género literario",
        "Figuras literarias",
        "Tipo de discurso",
      ],
    },
    "Análisis, interpretación e inferencias": {
      "Evidencia textual": ["Evidencia textual"],
      Inferencia: ["Inferencia", "Lenguaje figurado e inferencia"],
      "Comparación de dos textos": ["Comparación de dos textos"],
      "Tema y estructura": [
        "Tema y subtemas",
        "Estructura del texto",
        "Tema de un párrafo",
      ],
    },
    "Ideas explícitas e implícitas": {
      "Información explícita": [
        "Información explícita (afirmación verdadera)",
        "Información explícita (ejercicio con NO)",
        "Sentido literal",
        "Idea explícita en un fragmento",
        "Tema de la lectura",
      ],
      "Causa y propósito": [
        "Causa y efecto",
        "Causa y propósito",
        "Propósito del texto",
      ],
    },
    "Vocabulario en contexto": {
      "Significado en contexto": [
        "Significado de una palabra en contexto",
        "Lenguaje figurado en contexto",
      ],
    },
  },
  matematicas: {
    "Análisis de datos y Probabilidad": {
      Estadística: [
        "Media aritmética",
        "Mediana",
        "Razón e interpretación de gráficas",
      ],
      "Probabilidad y conteo": [
        "Probabilidad de eventos independientes",
        "Conteo (principio de multiplicación)",
        "Conteo (permutaciones)",
        "Diagramas de Venn",
      ],
    },
    Aritmética: {
      Porcentajes: [
        "Porcentajes y problemas verbales",
        "Porcentajes y fracciones",
      ],
      "Razón, tasa y proporción": ["Razón y tasa", "Razón y proporción"],
      "Operaciones y números mixtos": [
        "Operaciones con números mixtos",
        "Orden de las operaciones",
      ],
    },
    Geometría: {
      "Triángulos y Pitágoras": [
        "Teorema de Pitágoras",
        "Triángulo isósceles y teorema de Pitágoras",
        "Triángulo isósceles y perímetro",
      ],
      "Ángulos y rectas paralelas": [
        "Ángulos en un trapecio",
        "Rectas paralelas y ángulos",
        "Rectas paralelas y ángulos de un triángulo",
      ],
      "Perímetro, área y circunferencia": [
        "Perímetro de un cuadrado",
        "Perímetro de un rectángulo",
        "Área de un trapecio",
        "Circunferencia",
      ],
      "Plano cartesiano": [
        "Triángulos en el plano cartesiano",
        "Distancia entre dos puntos",
      ],
    },
    Álgebra: {
      "Ecuaciones y sistemas": [
        "Sistemas de ecuaciones lineales",
        "Ecuaciones cuadráticas",
        "Ecuaciones con fracciones",
      ],
      Desigualdades: [
        "Desigualdades lineales en dos variables",
        "Desigualdades con valor absoluto",
        "Desigualdades lineales en una variable",
      ],
      "Rectas y funciones": [
        "Ecuación de una recta",
        "Pendiente de una recta",
        "Relaciones lineales en tablas",
        "Funciones crecientes (gráficas)",
        "Evaluación de funciones",
      ],
      "Expresiones algebraicas": [
        "Traducción de frases a expresiones algebraicas",
        "Leyes de los exponentes",
        "Teorema del residuo",
      ],
    },
  },
  ingles: {
    "Comprensión de lectura": {
      "Información explícita": [
        "Detalle explícito",
        "Información ausente en el texto",
        "Hecho y opinión",
      ],
      "Idea principal y vocabulario": [
        "Idea principal y título",
        "Vocabulario en contexto",
      ],
    },
    "Redacción indirecta": {
      "Combinar oraciones": ["Combinar oraciones"],
      "Organización del texto": [
        "Organización del texto",
        "Palabras de transición",
      ],
      "Gramática y puntuación": [
        "Preposiciones y orden de la oración",
        "Forma verbal",
        "Preposiciones",
        "Orden de las palabras y cláusulas",
        "Estructura de la oración",
        "Concordancia sujeto-verbo",
        "Doble negación",
        "Puntuación",
        "Uso correcto de palabras",
      ],
    },
    "Uso del lenguaje y vocabulario": {
      Vocabulario: [
        "Vocabulario: ocupaciones",
        "Vocabulario",
        "Vocabulario: la familia",
        "Vocabulario en contexto",
      ],
      "Gramática básica": [
        "Sustantivos en plural",
        "Adjetivos posesivos",
        "Pasado simple",
        "Pasado simple negativo",
        "Orden de las palabras: adjetivos",
        "Orden de la oración",
      ],
      "Preguntas y respuestas": [
        "Preguntas y respuestas",
        "Formación de preguntas (presente simple)",
      ],
    },
  },
};

// Case, spacing and a space after a hyphen (a wrapped line in the PDF) do not matter.
const norm = (value = "") =>
  value
    .trim()
    .replace(/-\s+/g, "-")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");

const LOOKUP = new Map<string, string>();
for (const [section, domains] of Object.entries(GROUPS))
  for (const [domain, skills] of Object.entries(domains))
    for (const [coarse, fine] of Object.entries(skills))
      for (const label of fine)
        LOOKUP.set(`${section}|${norm(domain)}|${norm(label)}`, coarse);

/** The grouped skill for a PAA label, or the label itself when it is not listed. */
export function coarsePaaSkill(
  section: string,
  domain: string,
  skill: string,
): string {
  return LOOKUP.get(`${section}|${norm(domain)}|${norm(skill)}`) ?? skill;
}

/** Applies the grouping to one question, keeping the original label as `skillDetail`. */
export function groupPaaSkill<
  T extends Pick<Question, "section" | "domain" | "skill" | "skillDetail">,
>(question: T): T {
  if (!question.skill || !question.domain) return question;
  const coarse = coarsePaaSkill(
    question.section,
    question.domain,
    question.skill,
  );
  if (coarse === question.skill) return question;
  return {
    ...question,
    skill: coarse,
    skillDetail: question.skillDetail ?? question.skill,
  };
}

export const PAA_SKILL_GROUPS = GROUPS;
