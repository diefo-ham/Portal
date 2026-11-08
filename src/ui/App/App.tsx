import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ASSESSMENTS,
  assessmentInfo,
  isAssessment,
  hasImportedQuestions,
  scopeStudyData,
} from "../../core/assessments";
import {
  beginSession,
  deleteSession,
  renameSession,
  resetStudyProgress,
  toggleSessionStar,
} from "../../core/commands";
import {
  defaultFilters,
  isPracticeTestSession,
  isTimedTestSession,
  type Assessment,
  type Filters as FilterValues,
  type Session,
} from "../../core/model";
import { filterQuestions, selectSessionQuestionIds } from "../../core/practice";
import { useStudy } from "../useStudy";
import { Practice } from "../Practice/Practice";
import {
  PracticeTestSetup,
  PracticeTestRun,
} from "../PracticeTest/PracticeTest";
import { Home } from "../Home";
import { Review } from "../Review";
import { applyUpdate, subscribeToUpdates, updateReady } from "../../updates";
import {
  eraseAllLocalData,
  removePdfQuestions,
  removeQuestionLibrary,
  storageErrorMessage,
} from "../../storage/localData";
import { useAppearance } from "../AppearanceSettings";
import { Browse } from "../Browse";
import { AddPdfsDialog } from "../AddPdfsDialog";
import { AssessmentProvider, translator } from "../i18n";
import { TimedTestRun, TimedTestSetup } from "../TimedTest";
import { TestsLocked } from "../TestsLocked";
import { UpdateDialog } from "./UpdateDialog";
import { TsiTests } from "../TsiTest/TsiTests";
import { usePersistedBoolean } from "@/src/helpers/usePersistedBoolean";
import { readStorage, writeStorage } from "@/src/utils/storage";
import { ActiveQuestionsDialog } from "./ActiveQuestionsDialog";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { Banners } from "./Banners";
import {
  practiceTestRetryFilters,
  reviewFilters,
  sessionRetry,
  timedTestRetryFilters,
} from "./retry";
import { SettingsPage } from "./SettingsPage";
import type { Page } from "@/src/types/ui";

/** Which test the person last used; a fresh browser starts on the SAT. */
const LAST_KEY = "sat-last-assessment";
const PROTECT_KEY = "sat-protect-tests";
const EXAMPLES_KEY = "sat-show-examples";
/** Hash routes work on any static host; no server rewrite is needed. */
const routeOf = (): Assessment | undefined => {
  const hash = location.hash.toLowerCase();
  return hash.startsWith("#/paa")
    ? "PAA"
    : hash.startsWith("#/tsi")
      ? "TSI"
      : hash.startsWith("#/sat")
        ? "SAT"
        : undefined;
};
const lastChoice = (): Assessment | undefined => {
  const last = readStorage(LAST_KEY);
  return isAssessment(last) ? last : undefined;
};
export const App = () => {
  const appearance = useAppearance();
  const [assessment, setAssessment] = useState<Assessment>(
    () => routeOf() ?? lastChoice() ?? "SAT",
  );
  const info = assessmentInfo(assessment);
  const t = useMemo(() => translator(assessment), [assessment]);
  const {
    data,
    archive,
    mutate,
    adoptLibrary,
    error,
    setError,
    loadingMessage,
    revoked,
  } = useStudy(assessment);
  // TSI questions labelled Original can be hidden, leaving the Official ones. The
  // choice is only offered when both kinds are stored, and only applies then, so
  // it can never leave a bank empty with nothing to turn back on.
  const [includeOriginal, setIncludeOriginal] = usePersistedBoolean(
    "sat-tsi-original",
    true,
  );
  const bothKinds = useMemo(() => {
    if (!info.hasOrigins || !data) return false;
    // The bundled examples are Original; they never decide whether the switch is offered.
    const mine = scopeStudyData(data, assessment).questions.filter(
      (question) => question.bundled !== true,
    );
    return (
      mine.some((question) => question.origin === "official") &&
      mine.some((question) => question.origin === "original")
    );
  }, [data, assessment, info.hasOrigins]);
  const hideOrigin = bothKinds && !includeOriginal ? "original" : undefined;
  // Tests are built from the person's own questions only, and stay locked until
  // there are some: the bundled examples are for studying.
  const ownQuestions = useMemo(
    () => (data ? hasImportedQuestions(data, assessment) : false),
    [data, assessment],
  );
  // Once a test has questions of the person's own, its bundled examples are
  // hidden unless they ask for them (the TSI shows them unless they ask it not
  // to). A test with none keeps its examples, so it is never empty. Nothing is
  // deleted either way. One choice covers all three tests; until it is made,
  // each test follows its own default.
  const [chosenExamples, setChosenExamples] = useState<boolean | undefined>(
    () => {
      const stored = readStorage(EXAMPLES_KEY);
      return stored === "true" ? true : stored === "false" ? false : undefined;
    },
  );
  const showExamples = chosenExamples ?? info.examplesByDefault;
  const setShowExamples = (next: boolean) => {
    setChosenExamples(next);
    writeStorage(EXAMPLES_KEY, String(next));
  };
  const hideBundled = ownQuestions && !showExamples;
  const offerExamples = useMemo(
    () =>
      !!data &&
      data.questions.some((question) => question.bundled === true) &&
      ASSESSMENTS.some((id) => hasImportedQuestions(data, id)),
    [data],
  );
  const scoped = useMemo(
    () =>
      data
        ? scopeStudyData(data, assessment, { hideOrigin, hideBundled })
        : undefined,
    [data, assessment, hideOrigin, hideBundled],
  );
  const testView = useMemo(
    () =>
      data
        ? scopeStudyData(data, assessment, { hideOrigin, hideBundled: true })
        : undefined,
    [data, assessment, hideOrigin],
  );
  const [page, setPage] = useState<Page>("home");
  const [protectedTests, setProtectedTests] = usePersistedBoolean(
    PROTECT_KEY,
    true,
  );
  const [timerDefault, setTimerDefault] = usePersistedBoolean(
    "sat-timer-default",
    true,
  );
  const [deleteRemovesAnswers, setDeleteRemovesAnswers] = usePersistedBoolean(
    "sat-delete-removes-answers",
    false,
  );
  const [showCorrectExplanations, setShowCorrectExplanations] =
    usePersistedBoolean("sat-show-correct-explanations", false);
  const protect = info.protectedTests && protectedTests;
  const [filters, setFilters] = useState<FilterValues>(() => ({
    ...defaultFilters,
    active:
      readStorage(PROTECT_KEY) === "false" ||
      !assessmentInfo(routeOf() ?? "SAT").protectedTests
        ? "include"
        : "hide",
  }));
  const [sessionId, setSessionId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const newVersion = useSyncExternalStore(subscribeToUpdates, updateReady);
  const [message, setMessage] = useState("");
  // Said once, when the app opens and removes questions of a PDF whose access
  // code is no longer accepted.
  useEffect(() => {
    if (revoked)
      setMessage(
        t(
          "{n} questions from PDFs without a valid access code were removed. Your answers and bookmarks stay; add a current PDF to bring the questions back.",
          { n: revoked },
        ),
      );
  }, [revoked]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState("10");
  const [visible, setVisible] = useState(40);
  const [pendingStart, setPendingStart] = useState<{
    ids: string[];
    filters: FilterValues;
    name?: string;
  }>();
  const choose = (next: Assessment) => {
    writeStorage(LAST_KEY, next);
    const hash = "#/" + next.toLowerCase();
    if (location.hash.toLowerCase() !== hash) location.hash = hash;
    setAssessment(next);
  };
  // Screen readers and spell-checkers follow the test's language.
  useEffect(() => {
    document.documentElement.lang = info.language;
  }, [info.language]);
  useEffect(() => {
    const sync = () => {
      const linked = routeOf();
      if (linked) setAssessment(linked);
    };
    // The address may have changed between the first render and now.
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  // Switching tests starts that test's own home, with its own filters.
  useEffect(() => {
    setPage("home");
    setSessionId("");
    setMessage("");
    setVisible(40);
    setFilters({
      ...defaultFilters,
      active: protect ? "hide" : "include",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(storageErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // The PDF reader is loaded only when someone prepares a library from PDFs.
  const prepareSatPdfs = async (
    files: File[],
    options: Parameters<
      (typeof import("../../importing/pdf/run"))["prepareFromSatPdfs"]
    >[1],
  ) => {
    const { prepareFromSatPdfs } = await import("../../importing/pdf/run");
    return adoptLibrary(() => prepareFromSatPdfs(files, options));
  };
  const prepareTsiPdfs = async (
    files: File[],
    options: Parameters<
      (typeof import("../../importing/pdf/run"))["prepareFromTsiPdfs"]
    >[1],
  ) => {
    const { prepareFromTsiPdfs } = await import("../../importing/pdf/run");
    return adoptLibrary(() => prepareFromTsiPdfs(files, options));
  };
  const detectPdf = async (file: File) => {
    const { detectBankKind } = await import("../../importing/pdf/run");
    return detectBankKind(file);
  };
  const preparePaaPdfs = async (
    files: File[],
    options: Parameters<
      (typeof import("../../importing/pdf/run"))["prepareFromPaaPdfs"]
    >[1],
  ) => {
    const { prepareFromPaaPdfs } = await import("../../importing/pdf/run");
    return adoptLibrary(() => prepareFromPaaPdfs(files, options));
  };
  const beginSelectedSession = async ({
    ids,
    filters: sessionFilters,
    name,
  }: {
    ids: string[];
    filters: FilterValues;
    name?: string;
  }) => {
    await run(async () => {
      let id = "";
      await mutate((d) => {
        id = beginSession(d, ids, sessionFilters, name, timerDefault).id;
      });
      setSessionId(id);
      setMessage("");
      setPage("practice");
    });
  };
  const start = async (
    ids: string[],
    size = 0,
    sessionFilters = filters,
    name?: string,
  ) => {
    if (!ids.length) return;
    const selected = selectSessionQuestionIds(
      scoped?.questions ?? [],
      ids,
      size,
      scoped?.sessions.at(-1)?.questionIds,
    );
    const request = { ids: selected, filters: sessionFilters, name };
    if (
      info.protectedTests &&
      scoped?.questions.some(
        (q) => selected.includes(q.id) && q.testStatus === "active",
      )
    ) {
      setPendingStart(request);
      return;
    }
    await beginSelectedSession(request);
  };
  if (!data)
    return (
      <main className="page">
        <h1>SAT Study</h1>
        <p>{error || loadingMessage}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </main>
    );
  const view = scoped ?? data;
  const testData = testView ?? view;
  const filtered = filterQuestions(view, filters);
  const current = view.sessions.find((s) => s.id === sessionId);
  const changeFilters = (value: FilterValues) => {
    setFilters(value);
    setVisible(40);
  };
  const openSession = (id: string) => {
    setSessionId(id);
    setPage("practice");
  };
  const changeSessionName = (id: string, name: string) =>
    void run(() => mutate((draft) => renameSession(draft, id, name)));
  const changeSessionStar = (id: string) =>
    void run(() => mutate((draft) => toggleSessionStar(draft, id)));
  const removeSession = (id: string) =>
    void run(() =>
      mutate((draft) => deleteSession(draft, id, deleteRemovesAnswers)),
    );
  const repracticeSession = (session: Session) => {
    const { filters: again, name } = sessionRetry(session, "entire");
    void start(session.questionIds, 0, again, name);
  };
  const clearStudyFilters = () =>
    changeFilters({ ...filters, status: "", statuses: [], bookmark: "" });
  const removePdf = (key: string) =>
    run(async () => {
      await adoptLibrary(async () => ({
        result: { data: await removePdfQuestions(assessment, key) },
      }));
      setSessionId("");
      setMessage(
        t(
          "PDF removed. Add it again whenever you like; your answers and bookmarks were kept.",
        ),
      );
    });
  const restoreProgress = () =>
    run(async () => {
      await mutate(() => {}, { resetArchive: "restore", assessment });
      setSessionId("");
      clearStudyFilters();
      setMessage(t("Previous study state restored. Saved timers are paused."));
    });
  const resetProgress = (clearBookmarks: boolean) =>
    run(async () => {
      await mutate((d) => resetStudyProgress(d, clearBookmarks, assessment), {
        resetArchive: "save",
        assessment,
      });
      setSessionId("");
      clearStudyFilters();
      setMessage(
        t("Study progress reset. Your question bank is ready to use."),
      );
    });
  const removeQuestions = () =>
    run(async () => {
      await adoptLibrary(async () => ({
        result: { data: await removeQuestionLibrary(assessment) },
      }));
      setSessionId("");
      setMessage(
        t("Questions removed. Add your PDFs again whenever you like."),
      );
    });
  const eraseEverything = () =>
    run(async () => {
      await eraseAllLocalData();
      location.reload();
    });
  return (
    <AssessmentProvider value={assessment}>
      {!(page === "practice" && current && !current.finishedAt) && (
        <AppHeader
          info={info}
          assessments={ASSESSMENTS.map(assessmentInfo)}
          page={page}
          testOpen={
            !!(current?.practiceTest || current?.timedTest || current?.tsiTest)
          }
          onHome={() => setPage("home")}
          onNavigate={(next) => {
            setPage(next);
            setMessage("");
          }}
          onSwitchAssessment={choose}
        />
      )}
      {newVersion && <UpdateDialog onUpdate={applyUpdate} />}
      <Banners
        error={error}
        onDismissError={() => setError("")}
        message={message}
        onDismissMessage={() => setMessage("")}
      />
      {pendingStart && (
        <ActiveQuestionsDialog
          busy={busy}
          onCancel={() => setPendingStart(undefined)}
          onBegin={() => {
            const request = pendingStart;
            setPendingStart(undefined);
            void beginSelectedSession(request);
          }}
        />
      )}
      {page === "tests" && !ownQuestions ? (
        <TestsLocked onAddQuestions={() => setAddOpen(true)} />
      ) : page === "tests" && info.fixedTests ? (
        <TsiTests
          data={testData}
          mutate={mutate}
          onOpen={openSession}
          removesAnswers={deleteRemovesAnswers}
          timerDefault={timerDefault}
          onAddQuestions={() => setAddOpen(true)}
        />
      ) : page === "tests" && info.testMode ? (
        <TimedTestSetup
          data={testData}
          mutate={mutate}
          onOpen={openSession}
          removesAnswers={deleteRemovesAnswers}
          onAddQuestions={() => setAddOpen(true)}
        />
      ) : page === "practice" && current && isTimedTestSession(current) ? (
        <TimedTestRun
          data={view}
          session={current}
          mutate={mutate}
          onBack={() => setPage("tests")}
          onRetry={(ids, kind) =>
            void start(ids, 0, timedTestRetryFilters(kind))
          }
        />
      ) : page === "tests" && info.practiceTests ? (
        <PracticeTestSetup
          data={testData}
          mutate={mutate}
          onOpen={openSession}
          onSettings={() => setPage("data")}
        />
      ) : page === "practice" && current && isPracticeTestSession(current) ? (
        <PracticeTestRun
          data={view}
          session={current}
          mutate={mutate}
          onBack={() => setPage("tests")}
          onRetry={(ids, kind) =>
            void start(ids, 0, practiceTestRetryFilters(kind))
          }
        />
      ) : page === "practice" && current ? (
        <Practice
          key={current.id}
          data={view}
          session={current}
          mutate={mutate}
          showCorrectExplanations={showCorrectExplanations}
          onBack={() => setPage(current.tsiTest ? "tests" : "home")}
          onRetry={(ids, kind) => {
            const { filters: again, name } = sessionRetry(current, kind);
            void start(ids, 0, again, name);
          }}
        />
      ) : page === "home" ? (
        <Home
          data={view}
          value={filters}
          onChange={changeFilters}
          limit={limit}
          setLimit={setLimit}
          busy={busy}
          protectTests={protect}
          onStart={(ids, size) => void start(ids, size)}
          sessionActions={{
            onOpen: openSession,
            onRename: changeSessionName,
            onDelete: removeSession,
            onToggleStar: changeSessionStar,
            onRepractice: repracticeSession,
            removesAnswers: deleteRemovesAnswers,
          }}
          onReview={() => setPage("review")}
          onBrowse={() => setPage("library")}
          onAddQuestions={() => setAddOpen(true)}
        />
      ) : page === "library" ? (
        <Browse
          data={view}
          filters={filters}
          filtered={filtered}
          visible={visible}
          onShowMore={() => setVisible(visible + 40)}
          onChangeFilters={changeFilters}
          protectTests={protect}
          onAddQuestions={() => setAddOpen(true)}
          mutate={mutate}
        />
      ) : page === "review" ? (
        <Review
          data={view}
          protectTests={protect}
          onStart={(ids, source) =>
            void start(ids, 0, reviewFilters(source, protect))
          }
          onOpen={openSession}
        />
      ) : (
        <SettingsPage
          appearance={appearance}
          preferences={{
            timerDefault,
            onTimerDefault: setTimerDefault,
            showCorrectExplanations,
            onShowCorrectExplanations: setShowCorrectExplanations,
            deleteRemovesAnswers,
            onDeleteRemovesAnswers: setDeleteRemovesAnswers,
            offerProtection: ownQuestions && info.protectedTests,
            exampleQuestions: offerExamples
              ? { checked: showExamples, onChange: setShowExamples }
              : undefined,
            originalQuestions: bothKinds
              ? { checked: includeOriginal, onChange: setIncludeOriginal }
              : undefined,
            protectedTests,
            onProtectedTests: (next) => {
              setProtectedTests(next);
              changeFilters({ ...filters, active: next ? "hide" : "include" });
            },
          }}
          maintenance={{
            data: view,
            busy,
            archiveDate: archive?.createdAt,
            onAddPdfs: () => setAddOpen(true),
            onRemovePdf: removePdf,
            onRestore: restoreProgress,
            onReset: resetProgress,
            onRemoveQuestions: removeQuestions,
            onEraseEverything: eraseEverything,
          }}
        />
      )}
      {page === "data" && <AppFooter />}
      <AddPdfsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prepareSat={prepareSatPdfs}
        preparePaa={preparePaaPdfs}
        prepareTsi={prepareTsiPdfs}
        detect={detectPdf}
      />
    </AssessmentProvider>
  );
};
