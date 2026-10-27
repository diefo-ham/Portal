import type {
  AnswerStatus,
  Difficulty,
  Filters as FilterValues,
  StudyData,
} from "../core/model";
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
  const answerStatusOptions = [
    { value: "incorrect", label: "Mistakes" },
    { value: "unanswered", label: "Unanswered" },
    { value: "completed", label: "Completed" },
  ];
  const answerStatuses = value.statuses?.length
    ? value.statuses
    : answerStatusOptions.some((option) => option.value === value.status)
      ? [value.status as AnswerStatus]
      : [];
  const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];
  const difficultyOptions = difficultyOrder
    .filter((difficulty) =>
      data.questions.some((question) => question.difficulty === difficulty),
    )
    .map((difficulty) => ({
      value: difficulty,
      label: difficulty[0].toUpperCase() + difficulty.slice(1),
    }));
  const difficulties = value.difficulties?.length
    ? value.difficulties
    : difficultyOptions.some((option) => option.value === value.difficulty)
      ? [value.difficulty as Difficulty]
      : [];
  const changeSection = (section: string) => {
    const sectionQuestions = data.questions.filter(
      (question) => !section || question.section === section,
    );
    const validDomainKeys = new Set(sectionQuestions.map(domainKey));
    const domains = (value.domains ?? []).filter((key) =>
      validDomainKeys.has(key),
    );
    const validSkillKeys = new Set(
      sectionQuestions
        .filter(
          (question) =>
            !domains.length || domains.includes(domainKey(question)),
        )
        .map(skillKey),
    );
    onChange({
      ...value,
      section,
      domain: "",
      skill: "",
      domains,
      skills: (value.skills ?? []).filter((key) => validSkillKeys.has(key)),
    });
  };
  return (
    <div className="filters">
      {!advanced && (
        <>
          <div className="section-filter">
            <span className="filter-label">Section</span>
            <div className="section-segments" role="group" aria-label="Section">
              {[
                ["", "All"],
                ["reading-writing", "Reading & Writing"],
                ["math", "Math"],
              ].map(([section, label]) => (
                <button
                  type="button"
                  key={section || "all"}
                  aria-pressed={value.section === section}
                  onClick={() => changeSection(section)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
          <MultiSelect
            label="Answer status"
            options={answerStatusOptions}
            value={answerStatuses}
            emptyLabel="All questions"
            selectionSummary={(labels) => labels.join(", ")}
            onChange={(statuses) =>
              onChange({
                ...value,
                status: "",
                statuses: statuses as AnswerStatus[],
              })
            }
          />
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
          <MultiSelect
            label="Difficulty"
            options={difficultyOptions}
            value={difficulties}
            emptyLabel="Any difficulty"
            selectionSummary={(labels) => labels.join(", ")}
            onChange={(selected) =>
              onChange({
                ...value,
                difficulty: "",
                difficulties: selected as Difficulty[],
              })
            }
          />
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
