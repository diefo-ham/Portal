import { useEffect, useRef, useState } from "react";
import type {
  Filters as FilterValues,
  Question,
  StudyData,
} from "../core/model";
import { defaultFilters } from "../core/model";
import { latestAttempt } from "../core/practice";
import { DocumentPanels } from "./DocumentPanels";
import { Filters, sectionName } from "./Filters";

type Mutate = (fn: (data: StudyData) => void) => Promise<StudyData>;

export function Browse({
  data,
  filters,
  filtered,
  visible,
  onShowMore,
  onChangeFilters,
  protectTests,
  busy,
  onSample,
  mutate,
}: {
  data: StudyData;
  filters: FilterValues;
  filtered: Question[];
  visible: number;
  onShowMore: () => void;
  onChangeFilters: (filters: FilterValues) => void;
  protectTests: boolean;
  busy: boolean;
  onSample: () => void;
  mutate: Mutate;
}) {
  const [selectedId, setSelectedId] = useState("");
  const questionTop = useRef<HTMLElement>(null);
  const selectedIndex = filtered.findIndex((q) => q.id === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : undefined;

  useEffect(() => {
    if (selectedId && !selected) setSelectedId("");
  }, [selectedId, selected]);

  useEffect(() => {
    if (selected) questionTop.current?.focus({ preventScroll: true });
  }, [selected?.id]);

  const open = (question: Question) => {
    if (
      question.testStatus === "active" &&
      !window.confirm(
        "This question belongs to an active practice test and may spoil a future Bluebook test. View it anyway?",
      )
    )
      return;
    setSelectedId(question.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const toggleBookmark = (question: Question) =>
    mutate((draft) => {
      const annotation = draft.annotations[question.id] || {
        bookmarked: false,
        note: "",
      };
      draft.annotations[question.id] = {
        ...annotation,
        bookmarked: !annotation.bookmarked,
      };
    });

  if (selected) {
    const attempt = latestAttempt(data, selected.id);
    const marked = !!data.annotations[selected.id]?.bookmarked;
    return (
      <main className="page browse-detail-page">
        <div className="browse-detail-toolbar">
          <button className="text-button" onClick={() => setSelectedId("")}>
            ← Back to questions
          </button>
          <span className="small muted">
            {selectedIndex + 1} of {filtered.length} matching questions
          </span>
        </div>
        <article
          className="question-card browse-question"
          ref={questionTop}
          tabIndex={-1}
          aria-label={`Browse question ${selectedIndex + 1}`}
        >
          <div className="question-heading">
            <div>
              <p className="eyebrow">{sectionName(selected.section)}</p>
              <span className="muted small">
                {selected.domain || "Domain unspecified"}
              </span>
            </div>
            <button
              className={marked ? "bookmark selected" : "bookmark"}
              aria-pressed={marked}
              aria-label={marked ? "Remove bookmark" : "Bookmark question"}
              title={marked ? "Remove bookmark" : "Bookmark question"}
              onClick={() => void toggleBookmark(selected)}
            >
              {marked ? "★" : "☆"}
            </button>
          </div>
          {selected.passage && (
            <div className="passage">{selected.passage}</div>
          )}
          {selected.media?.map((media, index) => (
            <figure key={index}>
              <img src={media.dataUrl} alt={media.alt} />
              <figcaption>{media.alt}</figcaption>
            </figure>
          ))}
          {selected.document ? (
            <>
              <h1 className="sr-only">Question {selected.sourceId}</h1>
              {selected.document.extractionWarnings?.map((warning, index) => (
                <p className="notice" key={index}>
                  {warning}
                </p>
              ))}
              <DocumentPanels question={selected} kind="question" />
            </>
          ) : (
            <>
              <h1 className="question-text">{selected.stem}</h1>
              {selected.answer.type === "choice" && (
                <ol className="browse-choices" aria-label="Answer choices">
                  {selected.choices?.map((choice) => (
                    <li key={choice.id}>
                      <span className="choice-letter">{choice.id}</span>
                      <span>{choice.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <div className="browse-metadata">
            <span>{selected.skill || "Skill unspecified"}</span>
            <span>{selected.difficulty || "Difficulty unspecified"}</span>
            <span>
              {attempt
                ? attempt.correct
                  ? "Latest result: correct"
                  : "Latest result: incorrect"
                : "No recorded answer"}
            </span>
            <span>Practice-test status: {selected.testStatus}</span>
            {selected.sourceId && <span>Source ID: {selected.sourceId}</span>}
          </div>
          <div className="question-footer browse-navigation">
            <button
              disabled={selectedIndex === 0}
              onClick={() => open(filtered[selectedIndex - 1])}
            >
              ← Previous
            </button>
            <button
              disabled={selectedIndex === filtered.length - 1}
              onClick={() => open(filtered[selectedIndex + 1])}
            >
              Next question →
            </button>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="page browse-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUESTION LIBRARY</p>
          <h1>Browse questions.</h1>
          <p className="muted">
            Search the question bank, inspect individual questions, and save the
            ones you want to revisit.
          </p>
        </div>
      </div>
      {!data.questions.length ? (
        <section className="empty-state">
          <h2>Your question library is empty.</h2>
          <p>
            Question libraries are prepared locally outside the study interface.
            Load the original examples to explore Browse.
          </p>
          <button className="primary" disabled={busy} onClick={onSample}>
            Load synthetic sample
          </button>
        </section>
      ) : (
        <>
          <section className="filter-panel">
            <div className="section-heading">
              <h2>Find a question</h2>
              <button
                className="text-button"
                onClick={() =>
                  onChangeFilters({
                    ...defaultFilters,
                    active: protectTests ? "hide" : "include",
                  })
                }
              >
                Reset filters
              </button>
            </div>
            <Filters data={data} value={filters} onChange={onChangeFilters} />
            <div className="filter-bottom">
              <label className="search">
                <span className="sr-only">Search questions</span>
                <input
                  placeholder="Search questions, skills, or source IDs…"
                  value={filters.search}
                  onChange={(event) =>
                    onChangeFilters({ ...filters, search: event.target.value })
                  }
                />
              </label>
            </div>
          </section>
          <div className="library-toolbar">
            <div>
              <h2>
                Matching questions{" "}
                <span className="count">{filtered.length}</span>
              </h2>
              <p className="small muted">
                {filters.active === "hide"
                  ? "Active practice-test questions are protected."
                  : "Active practice-test questions may appear."}
              </p>
            </div>
          </div>
          <div className="question-list">
            {filtered.slice(0, visible).map((question, index) => {
              const attempt = latestAttempt(data, question.id);
              const marked = !!data.annotations[question.id]?.bookmarked;
              return (
                <div className="question-row" key={question.id}>
                  <button
                    className="question-row-main"
                    onClick={() => open(question)}
                    aria-label={`${String(index + 1).padStart(2, "0")} ${sectionName(question.section)} ${question.stem}`}
                  >
                    <span className="row-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="row-body">
                      <span className="row-meta">
                        {sectionName(question.section)}
                        <span> / </span>
                        {question.domain || "Domain unspecified"}
                      </span>
                      <span className="row-title">{question.stem}</span>
                      <span className="small muted">
                        {question.skill || "Skill unspecified"}
                      </span>
                    </span>
                    <span className="row-tags">
                      <span
                        className={`status ${attempt ? (attempt.correct ? "correct" : "incorrect") : ""}`}
                      >
                        {attempt
                          ? attempt.correct
                            ? "Correct"
                            : "Incorrect"
                          : "Unanswered"}
                      </span>
                      <span className="small muted">
                        {question.difficulty || "Unspecified"}
                      </span>
                    </span>
                    <span className="row-arrow">↗</span>
                  </button>
                  <button
                    className={marked ? "bookmark selected" : "bookmark"}
                    aria-label={
                      marked ? "Remove bookmark" : "Bookmark question"
                    }
                    aria-pressed={marked}
                    onClick={() => void toggleBookmark(question)}
                  >
                    {marked ? "★" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <h2>No questions match yet.</h2>
              <p>Try broadening your filters.</p>
              <button
                onClick={() =>
                  onChangeFilters({
                    ...defaultFilters,
                    active: protectTests ? "hide" : "include",
                  })
                }
              >
                Reset filters
              </button>
            </div>
          )}
          {filtered.length > visible && (
            <button className="load-more" onClick={onShowMore}>
              Show more questions
            </button>
          )}
        </>
      )}
    </main>
  );
}
