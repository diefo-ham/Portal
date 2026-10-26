import type { Question } from "./model";

// Collapse casing/spacing only, within the original section/domain context.
// Similar-looking but substantively different source skills are never aliased.
export const metadataName = (value = "") => value.trim().replace(/\s+/g, " ");
export const metadataKey = (value = "") =>
  metadataName(value).toLocaleLowerCase("en-US");
export const domainKey = (q: Question) =>
  JSON.stringify([q.section, metadataKey(q.domain)]);
export const skillKey = (q: Question) =>
  JSON.stringify([q.section, metadataKey(q.domain), metadataKey(q.skill)]);
export interface TaxonomyOption {
  value: string;
  label: string;
  context: string;
}
export function taxonomyOptions(
  questions: Question[],
  kind: "domain" | "skill",
): TaxonomyOption[] {
  const groups = new Map<
    string,
    { question: Question; names: Map<string, number> }
  >();
  for (const q of questions) {
    if (!q[kind]) continue;
    const key = kind === "domain" ? domainKey(q) : skillKey(q);
    const group = groups.get(key) ?? {
      question: q,
      names: new Map<string, number>(),
    };
    const name = metadataName(q[kind]);
    group.names.set(name, (group.names.get(name) ?? 0) + 1);
    groups.set(key, group);
  }
  const options = [...groups].map(([value, group]) => ({
    value,
    label: [...group.names].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0],
    context: `${group.question.section === "math" ? "Math" : "Reading & Writing"}${kind === "skill" ? ` · ${group.question.domain || "Unspecified domain"}` : ""}`,
  }));
  return options
    .map((option) => ({
      ...option,
      label: options.some(
        (other) =>
          other.value !== option.value &&
          metadataKey(other.label) === metadataKey(option.label),
      )
        ? `${option.label} — ${option.context}`
        : option.label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
