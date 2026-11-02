/**
 * Answer keys and text normalization, ported from scripts/import_college_board.py.
 * The importer never solves a question or guesses an absent key: anything it
 * cannot read as an explicit, machine-readable answer throws.
 */

const NUMBER =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/;
const NUMBER_TOKEN = /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?/g;

export type Answer =
  { type: "choice"; value: string } | { type: "numeric"; accepted: string[] };

export type AnswerOrigin = "answer-key" | "rationale";

export function normalizedText(text: string): string {
  return text
    .replace(/\ufffd/g, " ")
    .replace(/\u00a0/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Text after the first "Rationale" line, or all of it when there is none. */
export function afterRationale(joined: string): string {
  const match = /(?:^|\n)Rationale\n/.exec(joined);
  return match ? joined.slice(match.index + match[0].length) : joined;
}

export function extractAnswer(joined: string): {
  answer: Answer;
  origin: AnswerOrigin;
} {
  const keys = [...joined.matchAll(/Correct Answer:\s*([^\n]+)/g)].map(
    (match) => match[1],
  );
  let origin: AnswerOrigin = "answer-key";
  const rationale = normalizedText(afterRationale(joined));
  const examples =
    /Note that ([+\-0-9.,/ andor]+) (?:are examples|is an example) of ways to enter a correct answer/.exec(
      rationale,
    );
  if (keys.length > 1) throw new Error("Multiple answer keys");
  let accepted: string[];
  if (keys.length) {
    const key = keys[0].trim().replace(/\u2212/g, "-");
    if (key.length === 1 && "ABCD".includes(key))
      return { answer: { type: "choice", value: key }, origin };
    accepted = key.split(",").map((value) => value.trim());
  } else {
    origin = "rationale";
    // Some official exports omit a separate key. Use only an explicit
    // correct-answer statement or list of accepted entries in the rationale.
    const choice = /^Choice ([A-D]) is (?:correct|the best answer)\./.exec(
      rationale,
    );
    if (choice) return { answer: { type: "choice", value: choice[1] }, origin };
    if (examples) accepted = examples[1].match(NUMBER_TOKEN) ?? [];
    else {
      const numeric =
        /^The correct answer is ([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[+-]?\.\d+)\./.exec(
          rationale,
        );
      if (!numeric)
        throw new Error("No explicit machine-readable correct answer");
      accepted = [numeric[1].replace(/,/g, "")];
    }
  }
  if (examples)
    accepted = [
      ...new Set([...accepted, ...(examples[1].match(NUMBER_TOKEN) ?? [])]),
    ];
  if (
    !accepted.length ||
    accepted.some(
      (value) =>
        !NUMBER.test(value) ||
        (value.includes("/") && Number(value.split("/")[1]) === 0),
    )
  )
    throw new Error(`Unsupported numeric answer: ${JSON.stringify(accepted)}`);
  return { answer: { type: "numeric", accepted }, origin };
}
