import type { Question } from "../core/model";
import { numericValue } from "../core/practice";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
export function parseQuestions(input: unknown): Question[] {
  if (
    !record(input) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.questions)
  )
    throw new Error("Expected { schemaVersion: 1, questions: [...] }.");
  if (input.questions.length > 20000)
    throw new Error("Import at most 20,000 questions at a time.");
  const ids = new Set<string>();
  return input.questions.map((raw, i) => {
    const fail = (message: string): never => {
      throw new Error(`Question ${i + 1}: ${message}`);
    };
    if (!record(raw)) return fail("expected an object.");
    if (
      !text(raw.id) ||
      ["__proto__", "constructor", "prototype"].includes(raw.id) ||
      ids.has(raw.id)
    )
      return fail("id must be unique, nonempty, and safe.");
    ids.add(raw.id);
    if (!["math", "reading-writing"].includes(String(raw.section)))
      return fail("section must be math or reading-writing.");
    if (!text(raw.stem)) return fail("stem is required.");
    const q: Question = {
      id: raw.id,
      section: raw.section as Question["section"],
      stem: raw.stem,
      testStatus: "unknown",
      answer: { type: "numeric", accepted: [] },
    };
    for (const key of [
      "sourceId",
      "source",
      "domain",
      "skill",
      "passage",
      "rationale",
    ] as const) {
      if (raw[key] != null) {
        if (typeof raw[key] !== "string") return fail(`${key} must be text.`);
        q[key] = raw[key];
      }
    }
    if (raw.difficulty != null) {
      if (!["easy", "medium", "hard"].includes(String(raw.difficulty)))
        return fail("invalid difficulty.");
      q.difficulty = raw.difficulty as Question["difficulty"];
    }
    if (raw.testStatus != null) {
      if (!["active", "inactive", "unknown"].includes(String(raw.testStatus)))
        return fail("invalid testStatus.");
      q.testStatus = raw.testStatus as Question["testStatus"];
    }
    if (raw.choices != null) {
      if (
        !Array.isArray(raw.choices) ||
        raw.choices.length < 2 ||
        raw.choices.some((c) => !record(c) || !text(c.id) || !text(c.text))
      )
        return fail("choices require at least two {id,text} entries.");
      q.choices = raw.choices.map((c) => ({
        id: c.id as string,
        text: c.text as string,
      }));
      if (new Set(q.choices.map((c) => c.id)).size !== q.choices.length)
        return fail("choice IDs must be unique.");
    }
    if (!record(raw.answer)) return fail("answer is required.");
    const choiceValue = raw.answer.value;
    if (
      raw.answer.type === "choice" &&
      text(choiceValue) &&
      q.choices?.some((c) => c.id === choiceValue)
    )
      q.answer = { type: "choice", value: choiceValue };
    else if (
      raw.answer.type === "numeric" &&
      Array.isArray(raw.answer.accepted) &&
      raw.answer.accepted.length &&
      raw.answer.accepted.every(
        (a) => typeof a === "string" && numericValue(a) !== undefined,
      )
    ) {
      q.answer = { type: "numeric", accepted: [...raw.answer.accepted] };
      if (q.choices) return fail("numeric answers cannot have choices.");
    } else
      return fail(
        "answer must reference a choice or provide numeric accepted strings.",
      );
    if (raw.media != null) {
      if (
        !Array.isArray(raw.media) ||
        raw.media.some(
          (m) =>
            !record(m) ||
            !text(m.alt) ||
            typeof m.dataUrl !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(
              m.dataUrl,
            ),
        )
      )
        return fail(
          "media requires alt text and embedded PNG/JPEG/WebP data URLs.",
        );
      q.media = raw.media.map((m) => ({
        alt: m.alt as string,
        dataUrl: m.dataUrl as string,
      }));
    }
    return q;
  });
}
export function mergeQuestions(
  existing: Question[],
  incoming: Question[],
  filename: string,
) {
  const result = [...existing];
  let skipped = 0;
  for (const q of incoming) {
    const sourceMatch =
      q.source &&
      q.sourceId &&
      result.find((e) => e.source === q.source && e.sourceId === q.sourceId);
    if (sourceMatch) {
      skipped++;
      continue;
    }
    const idMatch = result.find((e) => e.id === q.id);
    if (idMatch) {
      if (contentKey(idMatch) === contentKey(q)) {
        skipped++;
        continue;
      }
      throw new Error(
        `ID collision: ${q.id}. Use a distinct internal ID; existing progress was preserved.`,
      );
    }
    result.push({
      ...q,
      importMetadata: {
        filename,
        parser: "normalized-json-v1",
        importedAt: new Date().toISOString(),
      },
    });
  }
  return { questions: result, added: result.length - existing.length, skipped };
}

// Exact normalized content comparison only. Never infer identity from a shared stem.
function contentKey(q: Question) {
  return JSON.stringify([
    q.source,
    q.sourceId,
    q.section,
    q.domain,
    q.skill,
    q.difficulty,
    q.passage,
    q.stem,
    q.choices,
    q.answer,
    q.rationale,
    q.testStatus,
    q.media,
  ]);
}
