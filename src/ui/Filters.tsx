import type { Filters as FilterValues, StudyData } from "../core/model";
export const sectionName = (s: string) =>
  s === "math" ? "Math" : "Reading & Writing";
export function Filters({
  data,
  value,
  onChange,
}: {
  data: StudyData;
  value: FilterValues;
  onChange: (f: FilterValues) => void;
}) {
  const set = (key: keyof FilterValues, v: string) =>
    onChange({
      ...value,
      [key]: v,
      ...(key === "section"
        ? { domain: "", skill: "" }
        : key === "domain"
          ? { skill: "" }
          : {}),
    });
  const relevant = data.questions.filter(
    (q) => !value.section || q.section === value.section,
  );
  const options = (key: "domain" | "skill") =>
    [
      ...new Set(
        relevant
          .filter(
            (q) =>
              key !== "skill" || !value.domain || q.domain === value.domain,
          )
          .map((q) => q[key])
          .filter(Boolean),
      ),
    ].sort() as string[];
  return (
    <div className="filters">
      <label>
        Section
        <select
          value={value.section}
          onChange={(e) => set("section", e.target.value)}
        >
          <option value="">All sections</option>
          <option value="reading-writing">Reading & Writing</option>
          <option value="math">Math</option>
        </select>
      </label>
      <label>
        Domain
        <select
          value={value.domain}
          onChange={(e) => set("domain", e.target.value)}
        >
          <option value="">All domains</option>
          {options("domain").map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Skill
        <select
          value={value.skill}
          onChange={(e) => set("skill", e.target.value)}
        >
          <option value="">All skills</option>
          {options("skill").map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Difficulty
        <select
          value={value.difficulty}
          onChange={(e) => set("difficulty", e.target.value)}
        >
          <option value="">Any difficulty</option>
          {["easy", "medium", "hard"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Answer status
        <select
          value={value.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="">Any status</option>
          <option value="unanswered">Unanswered</option>
          <option value="correct">Correct · latest</option>
          <option value="incorrect">Incorrect · latest</option>
          <option value="completed">Completed</option>
          <option value="ever-missed">Ever missed</option>
        </select>
      </label>
      <label>
        Bookmarks
        <select
          value={value.bookmark}
          onChange={(e) => set("bookmark", e.target.value)}
        >
          <option value="">All questions</option>
          <option value="yes">Bookmarked only</option>
        </select>
      </label>
      <label>
        Practice-test status
        <select
          value={value.active}
          onChange={(e) => set("active", e.target.value)}
        >
          <option value="hide">Hide active questions</option>
          <option value="include">Include active questions</option>
          <option value="only">Active questions only</option>
          <option value="inactive">Inactive only</option>
          <option value="unknown">Unknown only</option>
        </select>
      </label>
    </div>
  );
}
