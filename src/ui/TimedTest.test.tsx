// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import {
  emptyData,
  type Question,
  type Section,
  type Session,
  type StudyData,
} from "../core/model";
import {
  PART_ORDER,
  beginTimedTest,
  completeTimedTest,
} from "../core/timedTest";
import { TimedTestRun, TimedTestSetup } from "./TimedTest";

afterEach(cleanup);

/** A small synthetic PAA bank: three questions in each of the four parts. */
const bank = (): StudyData => {
  const data = emptyData();
  for (const section of PART_ORDER as Section[])
    for (let i = 0; i < 3; i++)
      data.questions.push({
        id: `paa-${section}-${i}`,
        assessment: "PAA",
        section,
        domain: "Dominio",
        skill: "Destreza",
        difficulty: "medium",
        stem: `Pregunta ${section} ${i}`,
        choices: [
          { id: "A", text: "A" },
          { id: "B", text: "B" },
        ],
        answer: { type: "choice", value: "B" },
        testStatus: "unknown",
      } satisfies Question);
  return data;
};

const begin = (data: StudyData) =>
  beginTimedTest(data, { parts: [...PART_ORDER], count: 8, unusedOnly: false });

const store = (data: StudyData) =>
  vi.fn(async (fn: (draft: StudyData) => void) => {
    fn(data);
    return data;
  });

const setup = (
  data: StudyData,
  extra: { removesAnswers?: boolean; onAddQuestions?: () => void } = {},
  mutate = store(data),
) => {
  const onOpen = vi.fn();
  const user = userEvent.setup();
  render(
    <TimedTestSetup data={data} mutate={mutate} onOpen={onOpen} {...extra} />,
  );
  return { user, mutate, onOpen };
};

const actionsFor = (session: Session) =>
  screen.getByRole("button", { name: `Acciones de ${session.name!}` });

describe("TimedTestSetup", () => {
  it("asks for questions when the bank is empty", async () => {
    const onAddQuestions = vi.fn();
    const { user } = setup(emptyData(), { onAddQuestions });
    expect(
      screen.getByRole("heading", {
        name: "Agrega tus preguntas para empezar.",
      }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Agrega tus PDF de preguntas" }),
    );
    expect(onAddQuestions).toHaveBeenCalledOnce();
  });

  it("shows the form and no list for a fresh bank", () => {
    setup(bank());
    expect(
      screen.getByRole("heading", { name: "Prepara tu prueba" }),
    ).toBeTruthy();
    expect(screen.queryByText("Tus pruebas")).toBeNull();
  });

  describe("starting", () => {
    it("begins the test with the default choices and opens it", async () => {
      const data = bank();
      const { user, mutate, onOpen } = setup(data);
      await user.click(
        screen.getByRole("button", { name: /Empezar la prueba/ }),
      );
      await waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).toHaveLength(1);
      expect(onOpen).toHaveBeenCalledWith(data.sessions[0].id);
      expect(data.sessions[0].timedTest).toBeTruthy();
    });

    it("shows the reason in an alert when the test cannot begin", async () => {
      const data = bank();
      const mutate = vi.fn().mockRejectedValue(new Error("No hay espacio."));
      const { user, onOpen } = setup(data, {}, mutate);
      await user.click(
        screen.getByRole("button", { name: /Empezar la prueba/ }),
      );
      expect((await screen.findByRole("alert")).textContent).toBe(
        "No hay espacio.",
      );
      expect(onOpen).not.toHaveBeenCalled();
      expect(
        (
          screen.getByRole("button", {
            name: /Empezar la prueba/,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
  });

  describe("with a test in progress", () => {
    it("hides the form and says to resume or cancel", () => {
      const data = bank();
      begin(data);
      setup(data);
      expect(
        screen.getByRole("heading", { name: "Tienes una prueba sin terminar" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("heading", { name: "Prepara tu prueba" }),
      ).toBeNull();
    });

    it("lists it as en curso with a Retomar button", async () => {
      const data = bank();
      const session = begin(data);
      const { user, onOpen } = setup(data);
      const row = screen.getByRole("listitem");
      expect(within(row).getByText(session.name!)).toBeTruthy();
      expect(within(row).getByText(/· en curso$/)).toBeTruthy();
      await user.click(within(row).getByRole("button", { name: "Retomar" }));
      expect(onOpen).toHaveBeenCalledWith(session.id);
    });

    it("offers Cancelar la prueba, and removes it when confirmed", async () => {
      const data = bank();
      const session = begin(data);
      const { user, mutate } = setup(data);
      await user.click(actionsFor(session));
      expect(
        screen.queryByRole("menuitem", { name: "Borrar examen" }),
      ).toBeNull();
      await user.click(
        screen.getByRole("menuitem", { name: "Cancelar la prueba" }),
      );
      const dialog = screen.getByRole("dialog", {
        name: "¿Abandonar esta prueba?",
      });
      expect(dialog.textContent).toContain(`«${session.name!}» sin resultados`);
      await user.click(
        within(dialog).getByRole("button", { name: "Cancelar la prueba" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).not.toContain(session);
    });

    it("keeps the test when the person changes their mind", async () => {
      const data = bank();
      const session = begin(data);
      const { user, mutate } = setup(data);
      await user.click(actionsFor(session));
      await user.click(
        screen.getByRole("menuitem", { name: "Cancelar la prueba" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Conservar la prueba" }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(data.sessions).toContain(session);
    });
  });

  describe("with a finished test", () => {
    const finished = () => {
      const data = bank();
      const session = begin(data);
      completeTimedTest(data, session.id);
      session.finishedAt = "2026-03-01T10:00:00.000Z";
      return { data, session };
    };

    it("shows the score and offers Ver resultados", async () => {
      const { data, session } = finished();
      const { user, onOpen } = setup(data);
      expect(screen.getByText(/0 de 8 correctas \(0%\) · /)).toBeTruthy();
      expect(
        screen.getByRole("heading", { name: "Prepara tu prueba" }),
      ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Ver resultados" }));
      expect(onOpen).toHaveBeenCalledWith(session.id);
    });

    it("offers Borrar examen and says the answers are kept", async () => {
      const { data, session } = finished();
      const { user } = setup(data);
      await user.click(actionsFor(session));
      expect(
        screen.queryByRole("menuitem", { name: "Cancelar la prueba" }),
      ).toBeNull();
      await user.click(screen.getByRole("menuitem", { name: "Borrar examen" }));
      const dialog = screen.getByRole("dialog", {
        name: "¿Borrar esta prueba?",
      });
      expect(dialog.textContent).toContain(
        `«${session.name!}» con sus resultados`,
      );
      expect(dialog.textContent).toContain(
        "Tus respuestas se conservan en tu historial de estudio.",
      );
    });

    it("says the answers go too when the setting is on", async () => {
      const { data, session } = finished();
      const { user } = setup(data, { removesAnswers: true });
      await user.click(actionsFor(session));
      await user.click(screen.getByRole("menuitem", { name: "Borrar examen" }));
      expect(screen.getByRole("dialog").textContent).toContain(
        "Sus respuestas también se quitarán de tu progreso",
      );
    });

    it("deletes the test when confirmed", async () => {
      const { data, session } = finished();
      const { user, mutate } = setup(data);
      await user.click(actionsFor(session));
      await user.click(screen.getByRole("menuitem", { name: "Borrar examen" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Borrar examen",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(data.sessions).not.toContain(session);
      expect(screen.queryByText("Tus pruebas")).toBeNull();
    });
  });

  describe("renaming", () => {
    it("starts from the current name and saves the new one", async () => {
      const data = bank();
      const session = begin(data);
      const { user, mutate } = setup(data);
      await user.click(actionsFor(session));
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      const dialog = screen.getByRole("dialog", {
        name: "Renombrar la prueba",
      });
      expect(
        (
          within(dialog).getByLabelText(
            "Nombre de la prueba",
          ) as HTMLInputElement
        ).value,
      ).toBe(session.name!);
      const input = within(dialog).getByLabelText("Nombre de la prueba");
      await user.clear(input);
      await user.type(input, "Simulacro de marzo");
      await user.click(
        within(dialog).getByRole("button", { name: "Guardar nombre" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mutate).toHaveBeenCalledOnce();
      expect(session.name!).toBe("Simulacro de marzo");
      expect(screen.getByText("Simulacro de marzo")).toBeTruthy();
    });

    it("does nothing when cancelled", async () => {
      const data = bank();
      const session = begin(data);
      const before = session.name!;
      const { user, mutate } = setup(data);
      await user.click(actionsFor(session));
      await user.click(screen.getByRole("menuitem", { name: "Renombrar" }));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(session.name!).toBe(before);
    });
  });
});

/** Like the app: every save produces a new copy of the data, which the screen re-reads. */
function Stored({ initial, id }: { initial: StudyData; id: string }) {
  const [data, setData] = useState(initial);
  const mutate = useCallback(
    async (fn: (draft: StudyData) => void) => {
      const next = structuredClone(data);
      fn(next);
      setData(next);
      return next;
    },
    [data],
  );
  const session = data.sessions.find((s) => s.id === id)!;
  return (
    <TimedTestRun
      data={data}
      session={
        session as Session & { timedTest: NonNullable<Session["timedTest"]> }
      }
      mutate={mutate}
      onBack={() => {}}
      onRetry={() => {}}
    />
  );
}

describe("TimedTestRun", () => {
  it("moves through every question of a part, by Siguiente and by the overview", async () => {
    const data = bank();
    const session = beginTimedTest(data, {
      parts: ["lectura", "redaccion"],
      count: 6,
      unusedOnly: false,
    });
    const total = session.timedTest!.segments[0].questionIds.length;
    expect(total).toBe(6);
    const user = userEvent.setup();
    render(<Stored initial={data} id={session.id} />);
    for (let n = 1; n < total; n++) {
      await user.click(
        screen.getByRole("button", { name: /Siguiente pregunta/ }),
      );
      await waitFor(() =>
        expect(screen.getByLabelText(`Pregunta ${n + 1}`)).toBeTruthy(),
      );
    }
    // The overview reaches any question of the part, and the last one has no "next".
    await user.click(
      screen.getByRole("button", { name: "Revisar y terminar →" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Ir a la pregunta 2,/ }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Pregunta 2")).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: "Resumen" }));
    await user.click(
      await screen.findByRole("button", { name: /Ir a la pregunta 6,/ }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Pregunta 6")).toBeTruthy(),
    );
  });
});
