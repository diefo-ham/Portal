import { useEffect, useRef, useState } from "react";
import { finishSession, submitAnswer } from "../../core/commands";
import type { Session, StudyData } from "../../core/model";
import { numericValue } from "../../core/practice";
import {
  deadlinePassed,
  saveTestDraft,
  toggleReviewMark,
} from "../../core/practiceTest";
import "../../calculator/layout.scss";
import { CalculatorPanel } from "../../calculator/CalculatorPanel";
import { useCalculatorState } from "../../calculator/useCalculatorState";
import { useCalculatorToggle } from "@/src/helpers/useCalculatorToggle";
import { useModalPanel } from "@/src/helpers/useModalPanel";
import { time } from "../formatTime";
import { useT } from "../i18n";
import { PracticeTestResults } from "../PracticeTestResults";
import { SessionResults } from "../SessionResults";
import { useQuestionTimer } from "../useQuestionTimer";
import { AnswerChoices } from "./AnswerChoices";
import { AnswerFeedback } from "./AnswerFeedback";
import { CancelTestPanel } from "./CancelTestPanel";
import { practiceKeyAction } from "./keyboard";
import { LeavePanel } from "./LeavePanel";
import { PausedOverlay } from "./PausedOverlay";
import { PracticeDialog } from "./PracticeDialog";
import { PracticeToolbar } from "./PracticeToolbar";
import { QuestionContent } from "./QuestionContent";
import { QuestionDetails } from "./QuestionDetails";
import { QuestionFooter } from "./QuestionFooter";
import { QuestionHeading } from "./QuestionHeading";
import { SessionMap } from "./SessionMap";
import { ToolsPanel } from "./ToolsPanel";
import type { Mutate, RetryKind } from "@/src/types/ui";

type Panel = "overview" | "details" | "tools" | "leave" | "cancel-test";

export type PracticeProps = {
  testClock?: { label: string; ms: number; warning?: boolean };
  onFinishModule?: () => Promise<unknown>;
  onPauseTest?: () => Promise<unknown>;
  onResumeTest?: () => Promise<unknown>;
  onCancelTest?: () => Promise<unknown>;
  data: StudyData;
  session: Session;
  mutate: Mutate;
  showCorrectExplanations: boolean;
  onBack: () => void | Promise<unknown>;
  onRetry: (ids: string[], kind: RetryKind) => void;
};

export const Practice = ({
  data,
  session: storedSession,
  mutate,
  showCorrectExplanations,
  onBack,
  onRetry,
  testClock,
  onFinishModule,
  onPauseTest,
  onResumeTest,
  onCancelTest,
}: PracticeProps) => {
  const t = useT();
  const test = storedSession.practiceTest;
  const isTest = !!test && !storedSession.finishedAt;
  const module = isTest ? test.modules[test.currentModule] : undefined;
  // In a Practice Test only the current module's questions are in play.
  const session = module
    ? {
        ...storedSession,
        questionIds: module.questionIds,
        index: module.questionIds.indexOf(
          storedSession.questionIds[storedSession.index],
        ),
      }
    : storedSession;
  const question = data.questions.find(
    (q) => q.id === session.questionIds[session.index],
  )!;
  const attempt = data.attempts.find(
    (a) => a.questionId === question.id && a.sessionId === session.id,
  );
  const [pending, setPending] = useState(false);
  const dialog = useModalPanel<Panel>();
  const { panel } = dialog;
  const showTime = isTest || (session.timerVisible ?? false);
  const questionTop = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const calculatorWork = useCalculatorState(
    session.id,
    session.calculator,
    mutate,
  );
  const calculatorAvailable = session.finishedAt
    ? session.questionIds.some((id) =>
        data.questions.some(
          (candidate) => candidate.id === id && candidate.section === "math",
        ),
      )
    : question.section === "math";
  const calculator = useCalculatorToggle({
    available: calculatorAvailable,
    blocked: !!panel || pending || !!session.paused,
    paused: !!session.paused,
    work: calculatorWork,
    returnFocus: () => questionTop.current,
    focusAfterClose: () =>
      questionTop.current ??
      document.querySelector<HTMLElement>(".result-calculator"),
  });
  useEffect(() => {
    questionTop.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [question.id]);
  useEffect(() => {
    if (attempt) nextButton.current?.focus({ preventScroll: true });
  }, [attempt?.id]);
  const [draft, setDraft] = useState<{ id: string; value: string }>();
  const timer = useQuestionTimer(
    session.id,
    question.id,
    !session.paused && !session.finishedAt && !attempt,
    mutate,
  );
  const answer =
    draft?.id === question.id ? draft.value : session.drafts[question.id] || "";
  const canSubmit =
    !!answer &&
    (question.answer.type === "choice" || numericValue(answer) !== undefined);
  const annotation = data.annotations[question.id] || {
    bookmarked: false,
    note: "",
  };
  const markedForReview =
    isTest && !!test?.markedForReview?.includes(question.id);
  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      await fn();
    } catch {
      /* global error banner */
    } finally {
      setPending(false);
    }
  };
  const navigate = (index: number) =>
    run(async () => {
      if (session.paused) return;
      await timer.flush();
      await mutate((d) => {
        const current = d.sessions.find((s) => s.id === session.id)!;
        if (
          isTest &&
          (current.paused ||
            deadlinePassed(current) ||
            current.practiceTest?.currentModule !== test?.currentModule)
        )
          return;
        current.index = current.questionIds.indexOf(session.questionIds[index]);
      });
    });
  const finish = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      if (onFinishModule) await onFinishModule();
      else await mutate((d) => finishSession(d, session.id));
    });
  // In a test, "submitting" just moves on: answers are only checked at the end.
  const submit = () => {
    if (!isTest)
      return run(async () => {
        await timer.flush();
        await mutate((d) => submitAnswer(d, session.id, question.id, answer));
      });
    return session.index < session.questionIds.length - 1
      ? navigate(session.index + 1)
      : finish();
  };
  const choose = (value: string) => {
    if (session.paused) return;
    setDraft({ id: question.id, value });
    // Keep radio focus while its draft saves; transaction ordering still ensures
    // the draft is committed before a subsequent submission.
    void mutate((d) => {
      const current = d.sessions.find((s) => s.id === session.id)!;
      if (isTest) saveTestDraft(d, session.id, question.id, value);
      else current.drafts[question.id] = value;
    }).catch(() => {});
  };
  const toggleBookmark = () =>
    run(() =>
      mutate((d) => {
        if (isTest) {
          toggleReviewMark(d, session.id, question.id);
          return;
        }
        d.annotations[question.id] = {
          note: d.annotations[question.id]?.note || "",
          bookmarked: !d.annotations[question.id]?.bookmarked,
        };
      }),
    );
  const pauseTest = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      calculator.hide();
      await onPauseTest?.();
    });
  const exit = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      await onBack();
    });
  const leave = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      dialog.close();
      await onBack();
    });
  const togglePause = () =>
    run(async () => {
      await timer.flush();
      await mutate((d) => {
        const s = d.sessions.find((s) => s.id === session.id)!;
        s.paused = !s.paused;
      });
    });
  const setTimerVisible = (visible: boolean) =>
    void mutate((d) => {
      const current = d.sessions.find((s) => s.id === session.id);
      if (current) current.timerVisible = visible;
    }).catch(() => {});
  const finishFromPanel = () => {
    dialog.close();
    void finish();
  };
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  const calculatorPanel = (
    <CalculatorPanel
      state={calculatorWork.state}
      onChange={calculatorWork.change}
      onClose={calculator.close}
      autoFocus={calculator.autoFocus}
    />
  );
  if (session.finishedAt)
    return (
      <div className="completed-calculator-context">
        {storedSession.practiceTest ? (
          <PracticeTestResults
            data={data}
            session={storedSession}
            mutate={mutate}
            onBack={onBack}
            onRetry={onRetry}
          />
        ) : (
          <SessionResults
            data={data}
            session={session}
            mutate={mutate}
            onBack={onBack}
            onRetry={onRetry}
            onCalculator={calculatorAvailable ? calculator.show : undefined}
          />
        )}
        {calculator.visible && calculatorPanel}
      </div>
    );
  const answeredCount = isTest
    ? session.questionIds.filter((id) => session.drafts[id]).length
    : attempts.length;
  const titles: Record<Panel, string> = {
    overview: t("Question overview"),
    details: t("Question details"),
    leave: t("Leave this session?"),
    "cancel-test": "Cancel Practice Test?",
    tools: t("Practice tools"),
  };
  // With no panel open (the dialog is closed) the heading is never seen.
  const title = titles[panel ?? "tools"];
  return (
    <main
      onKeyDown={(e) => {
        const action = practiceKeyAction(e, {
          blocked: !!session.paused || !!panel || pending,
          choices: question.choices,
          isChoice: question.answer.type === "choice",
          answered: !!attempt,
          canSubmit,
          index: session.index,
          total: session.questionIds.length,
        });
        if (!action) return;
        e.preventDefault();
        if (action.type === "close-disclosure")
          action.disclosure.removeAttribute("open");
        else if (action.type === "leave") dialog.open("leave");
        else if (action.type === "bookmark") void toggleBookmark();
        else if (action.type === "choose")
          choose(answer === action.id ? "" : action.id);
        else if (action.type === "navigate") void navigate(action.index);
        else if (action.type === "finish") void finish();
        else if (action.type === "submit") void submit();
      }}
      className="practice-page focused-practice"
    >
      <PracticeToolbar
        index={session.index}
        total={session.questionIds.length}
        timer={
          showTime
            ? {
                text: time(
                  testClock
                    ? testClock.ms
                    : (session.elapsed[question.id] || 0) + timer.pendingMs,
                ),
                label: testClock?.label || t("Time on this question"),
                test: !!testClock,
                warning: !!testClock?.warning,
              }
            : undefined
        }
        pause={
          isTest
            ? {
                disabled: pending || !!session.paused,
                onPause: () => void pauseTest(),
              }
            : undefined
        }
        calculator={
          question.section === "math"
            ? {
                open: calculator.open,
                expanded: calculator.visible,
                disabled: !!session.paused,
                onToggle: calculator.open ? calculator.close : calculator.show,
              }
            : undefined
        }
        onExit={() => void exit()}
        onOverview={() => {
          if (isTest) void finish();
          else dialog.open("overview");
        }}
        onTools={() => dialog.open("tools")}
      />
      {module && (
        <p className="test-module-label small muted">
          {module.section === "math" ? "Math" : "Reading and Writing"} · Module{" "}
          {module.mix === "first" ? "1" : "2"}
        </p>
      )}
      <div className="progress-track">
        <div
          style={{
            width: `${(100 * answeredCount) / session.questionIds.length}%`,
          }}
        />
      </div>
      <div className="practice-layout">
        <article
          className="question-card"
          key={question.id}
          ref={questionTop}
          tabIndex={-1}
          aria-label={t("Question {n}", { n: session.index + 1 })}
        >
          <QuestionHeading
            question={question}
            isTest={isTest}
            marked={isTest ? markedForReview : annotation.bookmarked}
            onToggle={(byPointer) => {
              // Pointer activation returns to reading; keyboard activation keeps
              // button focus and its pressed state accessible.
              if (byPointer)
                questionTop.current?.focus({ preventScroll: true });
              void toggleBookmark();
            }}
          />
          <QuestionContent question={question} />
          <AnswerChoices
            question={question}
            answer={answer}
            attempt={attempt}
            disabled={!!attempt || pending || !!session.paused}
            onChange={choose}
            onSubmit={() => void submit()}
          />
          {!isTest && !attempt && (
            <button
              className="primary submit"
              disabled={pending || !canSubmit}
              onClick={() => void submit()}
            >
              {t("Check answer")}
            </button>
          )}
          {!isTest && attempt && (
            <AnswerFeedback
              question={question}
              attempt={attempt}
              showCorrectExplanations={showCorrectExplanations}
              showTime={showTime}
            />
          )}
          <QuestionFooter
            index={session.index}
            total={session.questionIds.length}
            isTest={isTest}
            answered={!!attempt}
            disabled={pending || !!session.paused}
            onPrevious={() => void navigate(session.index - 1)}
            onNext={() => void navigate(session.index + 1)}
            onFinish={() => void finish()}
            nextButtonRef={nextButton}
          />
        </article>
        {calculator.visible &&
          question.section === "math" &&
          !session.paused &&
          calculatorPanel}
      </div>
      <PracticeDialog
        dialogRef={dialog.dialog}
        title={title}
        showBack={dialog.parent === "tools" && panel !== "tools"}
        onBack={dialog.back}
        onDismiss={dialog.close}
        onCancel={(event) => {
          if (panel === "leave") {
            event.preventDefault();
            if (!pending) void leave();
          } else dialog.close();
        }}
        onClosed={dialog.onClosed}
      >
        {panel === "leave" && (
          <LeavePanel
            isTest={isTest}
            pending={pending}
            onStay={dialog.close}
            onLeave={() => void leave()}
          />
        )}
        {panel === "tools" && (
          <ToolsPanel
            isTest={isTest}
            showTime={showTime}
            paused={!!session.paused}
            pending={pending}
            onCancelTest={
              onCancelTest
                ? () => dialog.openFrom("tools", "cancel-test")
                : undefined
            }
            onOverview={() => {
              if (isTest) finishFromPanel();
              else dialog.openFrom("tools", "overview");
            }}
            onDetails={() => dialog.openFrom("tools", "details")}
            onShowTime={setTimerVisible}
            onTogglePause={() => void togglePause()}
            onFinish={finishFromPanel}
          />
        )}
        {panel === "cancel-test" && onCancelTest && (
          <CancelTestPanel
            pending={pending}
            onKeep={() => dialog.show("tools")}
            onConfirm={() => void run(onCancelTest)}
          />
        )}
        {panel === "overview" && (
          <SessionMap
            questionIds={session.questionIds}
            index={session.index}
            attempts={attempts}
            drafts={session.drafts}
            isTest={isTest}
            pending={pending}
            onGo={(index) => {
              dialog.close();
              void navigate(index);
            }}
            onFinish={finishFromPanel}
          />
        )}
        {panel === "details" && <QuestionDetails question={question} />}
      </PracticeDialog>
      {isTest && session.paused && (
        <PausedOverlay
          pending={pending}
          onResume={() => void run(async () => onResumeTest?.())}
          onExit={() => void onBack()}
        />
      )}
    </main>
  );
};
