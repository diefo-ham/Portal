import { test, expect, type Page } from "@playwright/test";
import { parseQuestions } from "../../src/importing/json";
import { seedStudyData } from "./seed";
import sample from "../fixtures/synthetic.json" with { type: "json" };

// Moving between the SAT and the PAA, keeping their progress apart, the PAA
// portal's own behaviour, and PAA test mode. Every spec starts with nothing
// remembered: a fresh browser opens the SAT.

const paa = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `paa-${id}`,
  assessment: "PAA",
  source: "PAA: banco de preguntas",
  sourceId: id,
  section: "matematicas",
  domain: "Aritmética",
  skill: "Razón y proporción",
  difficulty: "medium",
  stem: `Pregunta sintética ${id}.`,
  choices: [
    { id: "A", text: "Opción A" },
    { id: "B", text: "Opción B" },
    { id: "C", text: "Opción C" },
    { id: "D", text: "Opción D" },
  ],
  answer: { type: "choice", value: "B" },
  rationale: "Porque B es la opción correcta.",
  testStatus: "unknown",
  ...extra,
});

const paaQuestions = () =>
  parseQuestions({
    schemaVersion: 1,
    questions: [
      paa("l1", {
        section: "lectura",
        domain: "Vocabulario en contexto",
        skill: "Significado de una palabra en contexto",
        passage: "Una lectura sintética que comparten dos preguntas.",
        passageGroup: "paa-g-test",
      }),
      paa("l2", {
        section: "lectura",
        domain: "Vocabulario en contexto",
        skill: "Significado de una palabra en contexto",
        passage: "Una lectura sintética que comparten dos preguntas.",
        passageGroup: "paa-g-test",
      }),
      paa("m1"),
      paa("m2"),
      paa("g1", {
        choices: undefined,
        answer: { type: "numeric", accepted: ["2/3"] },
        stem: "Cuánto es dos tercios, como decimal.",
      }),
      paa("i1", { section: "ingles", domain: "Comprensión de lectura" }),
    ],
  });

async function seedBoth(page: Page) {
  await page.goto("/");
  await seedStudyData(page, {
    questions: [...parseQuestions(sample), ...paaQuestions()],
  });
}

test("a fresh browser opens the SAT, and the toggle swaps to the PAA and back", async ({
  page,
}) => {
  await seedBoth(page);
  await expect(
    page.getByRole("heading", { name: "What would you like to work on?" }),
  ).toBeVisible();
  const toggle = page.getByRole("button", {
    name: "Test: SAT. Switch to PAA",
  });
  await expect(toggle).toHaveText("SAT ⇄");
  await toggle.click();
  await expect(page).toHaveURL(/#\/paa$/);
  await expect(
    page.getByRole("heading", { name: "¿En qué quieres trabajar?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prueba: PAA. Cambiar a SAT" }),
  ).toHaveText("PAA ⇄");
  await page
    .getByRole("button", { name: "Prueba: PAA. Cambiar a SAT" })
    .click();
  await expect(
    page.getByRole("heading", { name: "What would you like to work on?" }),
  ).toBeVisible();
});

test("the last test is remembered, a link opens a given test, and back works", async ({
  page,
}) => {
  await seedBoth(page);
  await page.getByRole("button", { name: /Switch to PAA/ }).click();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¿En qué quieres trabajar?" }),
  ).toBeVisible();
  await page.goto("/#/sat");
  await expect(
    page.getByRole("heading", { name: "What would you like to work on?" }),
  ).toBeVisible();
  await page.goto("/#/paa");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "What would you like to work on?" }),
  ).toBeVisible();
});

test("the PAA portal is Spanish, with its own parts and no SAT-only tools", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Práctica", "Repaso", "Explorar", "Modo de prueba"])
    await expect(nav.getByRole("button", { name: label })).toBeVisible();
  await expect(page.getByText("Protect practice-test")).toHaveCount(0);
  const parts = page.getByRole("group", { name: "Parte" });
  for (const part of ["Lectura", "Redacción", "Matemáticas", "Inglés"])
    await expect(parts.getByRole("button", { name: part })).toBeVisible();
  // No "All" button: nothing selected means every part.
  await expect(parts.getByRole("button", { name: "Todas" })).toHaveCount(0);
  await expect(page.getByText("Reading & Writing")).toHaveCount(0);
  await expect(page.getByText("Máx. 6")).toBeVisible();
});

test("several parts can be chosen at once, and none means all", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  const parts = page.getByRole("group", { name: "Parte" });
  await parts.getByRole("button", { name: "Lectura" }).click();
  await expect(page.getByText("Máx. 2")).toBeVisible();
  await parts.getByRole("button", { name: "Inglés" }).click();
  await expect(page.getByText("Máx. 3")).toBeVisible();
  await expect(parts.getByRole("button", { name: "Lectura" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(parts.getByRole("button", { name: "Inglés" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await parts.getByRole("button", { name: "Lectura" }).click();
  await parts.getByRole("button", { name: "Inglés" }).click();
  await expect(page.getByText("Máx. 6")).toBeVisible();
  // The SAT has two parts, so it takes one at a time: none is the same as both.
  await page.goto("/#/sat");
  const sections = page.getByRole("group", { name: "Section" });
  const math = sections.getByRole("button", { name: "Math" });
  const reading = sections.getByRole("button", { name: "Reading & Writing" });
  await expect(sections.getByRole("button", { name: "All" })).toHaveCount(0);
  await expect(math).toHaveAttribute("aria-pressed", "false");
  await expect(reading).toHaveAttribute("aria-pressed", "false");
  await math.click();
  await expect(math).toHaveAttribute("aria-pressed", "true");
  await reading.click();
  await expect(math).toHaveAttribute("aria-pressed", "false");
  await expect(reading).toHaveAttribute("aria-pressed", "true");
  await reading.click();
  await expect(reading).toHaveAttribute("aria-pressed", "false");
});

test("progress is separate: answers, reset and counts never cross between tests", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page
    .getByRole("group", { name: "Parte" })
    .getByRole("button", { name: "Matemáticas" })
    .click();
  await page.getByRole("textbox", { name: "Tamaño de la sesión" }).fill("3");
  await page.getByRole("button", { name: "Empezar a practicar" }).click();
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByRole("article", { name: `Pregunta ${i + 1}` }),
    ).toBeVisible();
    const numeric = page.getByRole("textbox", {
      name: "Tu respuesta numérica",
    });
    if (await numeric.isVisible()) await numeric.fill(".667");
    else await page.getByRole("radio").nth(1).check();
    await page.getByRole("button", { name: "Comprobar la respuesta" }).click();
    await expect(page.getByText("Correcto. ¡Bien hecho!")).toBeVisible();
    await page
      .getByRole("button", { name: /Siguiente pregunta|Revisar la sesión/ })
      .click();
  }
  await expect(
    page.getByText("3 de 3 contestadas correctamente."),
  ).toBeVisible();
  // The SAT side saw nothing.
  await page.getByRole("button", { name: /Cambiar a SAT/ }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("No mistakes waiting to revisit.")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/^12 questions · 0 attempts/)).toBeVisible();
  // Resetting the PAA leaves the SAT alone.
  await page.getByRole("button", { name: /Switch to PAA/ }).click();
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByText(/6 preguntas · 3 intentos/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar el progreso de estudio" })
    .click();
  await page.getByRole("button", { name: "Confirmar el reinicio" }).click();
  await expect(page.getByText(/Se reinició el progreso/)).toBeVisible();
  await expect(page.getByText(/6 preguntas · 0 intentos/)).toBeVisible();
});

test("the PAA review shows percent correct and says it is not a PAA score", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Repaso" }).click();
  for (const part of ["Lectura", "Redacción", "Matemáticas", "Inglés"])
    await expect(page.getByRole("heading", { name: part })).toBeVisible();
  await expect(
    page.locator(".performance-note", {
      hasText: "No es una puntuación de la PAA",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Estimated SAT/)).toHaveCount(0);
});

test("test mode: parts in order, each with its own clock, locked once it ends, with a break between", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Modo de prueba" }).click();
  await expect(
    page.getByRole("heading", { name: "Modo de prueba" }),
  ).toBeVisible();
  // The full test is chosen to begin with, with a clock for each separately timed part.
  const parts = page.getByRole("group", { name: "Partes" });
  for (const part of ["Lectura", "Redacción", "Matemáticas", "Inglés"])
    await expect(parts.getByRole("button", { name: part })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  await expect(page.getByText(/Disponibles: 6\./)).toBeVisible();
  const plan = page.getByRole("table", { name: "Partes de la prueba" });
  for (const part of ["Lectura", "Matemáticas", "Inglés"])
    await expect(plan.getByRole("rowheader", { name: part })).toBeVisible();
  await expect(
    page
      .locator(".test-rules")
      .getByText(/no hay penalidad por contestar mal/i),
  ).toBeVisible();
  // The help describes test mode too.
  await page.getByRole("button", { name: "Ayuda y atajos de teclado" }).click();
  await expect(
    page.getByRole("dialog").getByText("Modo de prueba", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Cerrar la ayuda" }).click();
  await page
    .getByRole("textbox", { name: "Tiempo de Lectura (minutos)" })
    .fill("20");
  await page.getByRole("button", { name: "Empezar la prueba" }).click();

  // Part 1: Lectura (the two reading questions).
  await expect(page.getByRole("article", { name: "Pregunta 1" })).toBeVisible();
  await expect(page.locator(".question-card .eyebrow")).toHaveText("Lectura");
  await expect(page.getByLabel("Tiempo restante")).toContainText(/^(19|20):/);
  await expect(page.getByText("Pregunta 1 de 2")).toBeVisible();
  // There is no pause button during a part.
  await expect(page.getByRole("button", { name: "Pausar" })).toHaveCount(0);
  // No feedback while taking the test.
  await page.getByRole("radio").nth(1).check();
  await expect(page.getByText("Correcto. ¡Bien hecho!")).toHaveCount(0);
  // Mark, skip on, and come back.
  await page.getByRole("button", { name: "Marcar para revisar" }).click();
  await page.getByRole("button", { name: "Siguiente pregunta" }).click();
  // The overview is a page of its own, reachable from the toolbar at any time.
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen de preguntas" }),
  ).toBeVisible();
  await expect(page.getByText("1 sin contestar")).toBeVisible();
  const first = page.getByRole("button", {
    name: "Ir a la pregunta 1, contestada, marcada para revisar",
  });
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();

  // Finishing lives in the overview only: the question view has no finish button.
  await expect(page.getByRole("button", { name: /^Terminar/ })).toHaveCount(0);
  // End part 1: the dialog says it cannot be revisited.
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminar esta parte", exact: true })
    .click();
  await expect(page.getByText(/Contestaste 1 de 2/)).toBeVisible();
  await expect(page.getByText(/ya no podrás volver a ella/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Terminar esta parte" })
    .click();

  // Break: nothing is running, and the next part says what it is.
  await expect(
    page.getByRole("heading", { name: "Terminaste Lectura." }),
  ).toBeVisible();
  await expect(page.getByLabel("Tiempo restante")).toHaveCount(0);
  await expect(page.getByText(/no corre hasta que la empieces/)).toBeVisible();
  await page.getByRole("button", { name: "Empezar Matemáticas" }).click();

  // Part 2 has its own questions and clock; part 1 cannot be reached.
  await expect(page.locator(".question-card .eyebrow")).toHaveText(
    "Matemáticas",
  );
  await expect(page.getByText("Pregunta 1 de 3")).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir el resumen de preguntas" })
    .click();
  await expect(
    page.getByRole("button", { name: /^Ir a la pregunta \d/ }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Volver a la pregunta 1", exact: true })
    .click();
  await page.getByRole("radio").nth(1).check();

  // Leaving stops the clock; coming back asks to continue.
  await page.getByRole("button", { name: "← Salir" }).click();
  await expect(page.getByText("Tienes una prueba sin terminar")).toBeVisible();
  await page.getByRole("button", { name: "Retomar", exact: true }).click();
  await expect(page.getByText("Saliste de la prueba.")).toBeVisible();
  await page.getByRole("button", { name: "Seguir con la prueba" }).click();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();

  // End part 2, then take the last part and finish the test.
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminar esta parte", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Terminar esta parte" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Terminaste Matemáticas." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empezar Inglés" }).click();
  await expect(page.locator(".question-card .eyebrow")).toHaveText("Inglés");
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminar la prueba", exact: true })
    .click();
  await expect(page.getByText(/Contestaste 0 de 1/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Terminar la prueba" })
    .click();

  // Results laid out like the SAT's: a gauge and counts, how each part went, and the
  // domains and skills. No score.
  await expect(
    page.getByRole("heading", { name: "Resultados de la prueba" }),
  ).toBeVisible();
  await expect(page.getByText(/no una puntuación de la PAA/)).toBeVisible();
  await expect(page.locator(".score-counts")).toContainText("6 en total");
  const performance = page.getByRole("region", {
    name: "Rendimiento por parte",
  });
  for (const part of ["Lectura", "Matemáticas", "Inglés"])
    await expect(performance.getByText(part, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dominios y destrezas" }),
  ).toBeVisible();
  // The review is grouped by part, one part open at a time, like the SAT's by module.
  await expect(
    page.getByRole("heading", { name: "Repaso por parte" }),
  ).toBeVisible();
  const reviewParts = page.locator(".question-module-toggle");
  await expect(reviewParts).toHaveCount(3);
  await expect(reviewParts.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(reviewParts.nth(1)).toHaveAttribute("aria-expanded", "false");
  await reviewParts.nth(1).click();
  await expect(reviewParts.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(reviewParts.nth(1)).toHaveAttribute("aria-expanded", "true");
  const scope = page.getByRole("group", { name: "Parte de los resultados" });
  await scope.getByRole("button", { name: "Matemáticas" }).click();
  await expect(page.locator(".score-counts")).toContainText("3 en total");
  // The result is listed under Modo de prueba and stays out of ordinary practice lists.
  await page.getByRole("button", { name: "← Volver a la práctica" }).click();
  await expect(
    page.getByRole("heading", { name: "Tus pruebas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver resultados" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Práctica" }).click();
  await expect(page.getByRole("heading", { name: "Tus sesiones" })).toHaveCount(
    0,
  );
});

test("a part whose time has run out ends by itself and leads to a break", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-06-01T10:00:00Z") });
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Modo de prueba" }).click();
  await page
    .getByRole("textbox", { name: "Tiempo de Lectura (minutos)" })
    .fill("1");
  await page.getByRole("button", { name: "Empezar la prueba" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.clock.runFor(61_000);
  await expect(
    page.getByRole("heading", { name: "Terminaste Lectura." }),
  ).toBeVisible({ timeout: 15000 });
  // The test is not over: the next part waits for its own start.
  await expect(
    page.getByRole("button", { name: "Empezar Matemáticas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Resultados de la prueba" }),
  ).toHaveCount(0);
});

test("test mode: Enter moves on once an answer is chosen, and the bar counts the answered ones", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Modo de prueba" }).click();
  await page.getByRole("button", { name: "Empezar la prueba" }).click();
  const bar = page.getByRole("progressbar", {
    name: "Preguntas contestadas en esta parte",
  });
  await expect(page.getByText("Pregunta 1 de 2")).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
  // Without an answer, Enter does nothing, and moving on does not fill the bar.
  await page.keyboard.press("Enter");
  await expect(page.getByText("Pregunta 1 de 2")).toBeVisible();
  await page.getByRole("radio").nth(1).check();
  await expect(bar).toHaveAttribute("aria-valuenow", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Pregunta 2 de 2")).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("radio").nth(2).check();
  await expect(bar).toHaveAttribute("aria-valuenow", "2");
  // From the last question, Enter opens the overview.
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Resumen de preguntas" }),
  ).toBeVisible();
  await expect(page.getByText("Todas contestadas")).toBeVisible();
  await expect(bar).toHaveCount(0);
});

test("test mode: a test's ••• menu renames and deletes it", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Modo de prueba" }).click();
  await page
    .locator(".test-presets")
    .getByRole("button", { name: "Inglés", exact: true })
    .click();
  await page.getByRole("button", { name: "Empezar la prueba" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminar la prueba", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Terminar la prueba" })
    .click();
  await page.getByRole("button", { name: "← Volver a la práctica" }).click();
  await expect(
    page.getByRole("heading", { name: "Tus pruebas" }),
  ).toBeVisible();
  // No inline delete: it lives in the menu, like the SAT's Practice Tests.
  await expect(page.getByRole("button", { name: /^Eliminar/ })).toHaveCount(0);
  const menu = page.getByRole("button", { name: /^Acciones de/ });
  await menu.click();
  await page.getByRole("menuitem", { name: "Renombrar" }).click();
  await page.getByLabel("Nombre de la prueba").fill("Prueba de inglés");
  await page.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(
    page.getByText("Prueba de inglés", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Acciones de/ }).click();
  await page.getByRole("menuitem", { name: "Borrar examen" }).click();
  await expect(
    page.getByRole("heading", { name: "¿Borrar esta prueba?" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Borrar examen" })
    .click();
  await expect(page.getByRole("heading", { name: "Tus pruebas" })).toHaveCount(
    0,
  );
});

test("the skill filter is hidden when there is only one skill to pick", async ({
  page,
}) => {
  await seedBoth(page);
  await page.goto("/#/paa");
  await page.getByText("Afinar la selección").click();
  const skill = page.getByText("Destreza", { exact: true });
  await expect(skill).toBeVisible();
  // Lectura has a single skill in this bank: nothing to choose between.
  await page
    .getByRole("group", { name: "Parte" })
    .getByRole("button", { name: "Lectura" })
    .click();
  await expect(skill).toHaveCount(0);
});
