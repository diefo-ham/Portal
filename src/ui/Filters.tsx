import type {
  AnswerStatus,
  Difficulty,
  Filters as FilterValues,
  StudyData,
} from "../core/model";
import {
  assessmentInfo,
  offersProtection,
  sectionLabel,
} from "../core/assessments";
import { selectedSections } from "../core/practice";
import { domainKey, skillKey, taxonomyOptions } from "../core/taxonomy";
import { useAssessment, useT } from "./i18n";
import { MultiSelect } from "./MultiSelect";
export const sectionName = (s: string) => sectionLabel(s);
export type FiltersProps = {
  data: StudyData;
  value: FilterValues;
  onChange: (f: FilterValues) => void;
  compact?: boolean;
  advanced?: boolean;
};

export const Filters = ({
  data,
  value,
  onChange,
  compact = false,
  advanced = false,
}: FiltersProps) => {
  const t = useT();
  const assessment = useAssessment();
  const info = assessmentInfo(assessment);
  const sections = selectedSections(value);
  const relevant = data.questions.filter(
    (q) => !sections.length || sections.includes(q.section),
  );
  const skills = relevant.filter(
    (q) => !value.domains?.length || value.domains.includes(domainKey(q)),
  );
  // A choice of one skill is no choice: the filter shows only when there is something to pick.
  const skillOptions = taxonomyOptions(skills, "skill");
  const answerStatusOptions = [
    { value: "incorrect", label: t("Mistakes") },
    { value: "unanswered", label: t("Unanswered") },
    { value: "completed", label: t("Completed") },
  ];
  const answerStatuses = answerStatusOptions.some(
    (option) => option.value === value.status,
  )
    ? [value.status as AnswerStatus]
    : value.statuses?.length
      ? value.statuses
      : [];
  const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];
  const difficultyOptions = difficultyOrder
    .filter((difficulty) =>
      data.questions.some((question) => question.difficulty === difficulty),
    )
    .map((difficulty) => ({
      value: difficulty,
      label: t(difficulty[0].toUpperCase() + difficulty.slice(1)),
    }));
  const difficulties = value.difficulties?.length
    ? value.difficulties
    : difficultyOptions.some((option) => option.value === value.difficulty)
      ? [value.difficulty as Difficulty]
      : [];
  // With none pressed every part is included. A test with two parts takes one at a
  // time (both pressed would mean the same as none); pressing the other swaps it,
  // pressing the same one clears it. A test with more parts adds or removes each.
  const toggleSection = (part: string) => {
    const next = sections.includes(part)
      ? sections.filter((id) => id !== part)
      : info.parts.length > 2
        ? [...sections, part]
        : [part];
    const sectionQuestions = data.questions.filter(
      (question) => !next.length || next.includes(question.section),
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
      section: "",
      sections: next,
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
          <div
            className={`section-filter ${info.parts.length > 2 ? "wide" : ""}`}
          >
            <span className="filter-label">
              {t(info.id === "SAT" ? "Section" : "Test")}{" "}
              <span className="filter-hint">
                {t("· any if none is selected")}
              </span>
            </span>
            <div
              className="section-segments"
              role="group"
              aria-label={t(info.id === "SAT" ? "Section" : "Test")}
            >
              {info.parts.map((part) => (
                <button
                  type="button"
                  key={part.id}
                  aria-pressed={sections.includes(part.id)}
                  onClick={() => toggleSection(part.id)}
                >
                  {part.label}
                </button>
              ))}
            </div>
          </div>
          <MultiSelect
            label={t("Domain")}
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
            label={t("Answer status")}
            options={answerStatusOptions}
            value={answerStatuses}
            emptyLabel={t("All questions")}
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
          {(skillOptions.length > 1 || !!value.skills?.length) && (
            <MultiSelect
              label={t("Skill")}
              options={skillOptions}
              value={value.skills ?? []}
              onChange={(selected) =>
                onChange({ ...value, skill: "", skills: selected })
              }
            />
          )}
          <MultiSelect
            label={t("Difficulty")}
            options={difficultyOptions}
            value={difficulties}
            emptyLabel={t("Any difficulty")}
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
            {t("Bookmarked only")}
          </label>
          {offersProtection(data, assessment) && (
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
          )}
        </>
      )}
    </div>
  );
};
