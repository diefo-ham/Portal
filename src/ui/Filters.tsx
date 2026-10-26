import type { Filters as FilterValues, StudyData } from "../core/model";
import { domainKey, skillKey, taxonomyOptions } from "../core/taxonomy";
import { MultiSelect } from "./MultiSelect";
export const sectionName = (s: string) =>
  s === "math" ? "Math" : "Reading & Writing";
export function Filters({
  data,
  value,
  onChange,
  compact = false,
  advanced = false,
}: {
  data: StudyData;
  value: FilterValues;
  onChange: (f: FilterValues) => void;
  compact?: boolean;
  advanced?: boolean;
}) {
  const relevant = data.questions.filter(
    (q) => !value.section || q.section === value.section,
  );
  const skills = relevant.filter(
    (q) => !value.domains?.length || value.domains.includes(domainKey(q)),
  );
  return (
    <div className="filters">
      {!advanced && (
        <>
          <label>
            Section
            <select
              value={value.section}
              onChange={(e) =>
                onChange({
                  ...value,
                  section: e.target.value,
                  domain: "",
                  skill: "",
                  domains: [],
                  skills: [],
                })
              }
            >
              <option value="">Both sections</option>
              <option value="reading-writing">Reading & Writing</option>
              <option value="math">Math</option>
            </select>
          </label>
          <MultiSelect
            label="Domain"
            options={taxonomyOptions(relevant, "domain")}
            value={value.domains ?? []}
            onChange={(domains) =>
              onChange({
                ...value,
                domain: "",
                skill: "",
                domains,
                skills: (value.skills ?? []).filter((key) =>
                  relevant.some(
                    (q) =>
                      (!domains.length || domains.includes(domainKey(q))) &&
                      skillKey(q) === key,
                  ),
                ),
              })
            }
          />
          <label>
            Answer status
            <select
              value={value.status}
              onChange={(e) => onChange({ ...value, status: e.target.value })}
            >
              <option value="">All questions</option>
              <option value="unanswered">Unanswered</option>
              <option value="incorrect">Mistakes</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </>
      )}
      {!compact && (
        <>
          <MultiSelect
            label="Skill"
            options={taxonomyOptions(skills, "skill")}
            value={value.skills ?? []}
            onChange={(selected) =>
              onChange({ ...value, skill: "", skills: selected })
            }
          />
          <label>
            Difficulty
            <select
              value={value.difficulty}
              onChange={(e) =>
                onChange({ ...value, difficulty: e.target.value })
              }
            >
              <option value="">Any difficulty</option>
              {["easy", "medium", "hard"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="check-filter">
            <input
              type="checkbox"
              checked={!!value.bookmark}
              onChange={(e) =>
                onChange({ ...value, bookmark: e.target.checked ? "yes" : "" })
              }
            />{" "}
            Bookmarked only
          </label>
          <label className="check-filter">
            <input
              type="checkbox"
              checked={value.active === "hide"}
              onChange={(e) =>
                onChange({
                  ...value,
                  active: e.target.checked ? "hide" : "include",
                })
              }
            />{" "}
            Protect practice-test questions
          </label>
        </>
      )}
    </div>
  );
}
