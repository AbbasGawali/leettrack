"use client";

import { MAX_SUCCESSFUL_REVIEWS } from "@/lib/revision";
import type {
  Problem,
  ProblemProgress,
  ProgressStatus,
  SessionUser
} from "@/types/problem";
import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardProps = {
  user: SessionUser;
};

type StatusFilter = "all" | "solved" | "revision" | "due" | "unsolved";
type SortKey = "idDesc" | "idAsc" | "ratingDesc" | "ratingAsc" | "qAsc" | "qDesc";

type RevisionItem = {
  problem: Problem;
  progress: ProblemProgress;
  dueState: "due" | "tomorrow" | "upcoming";
  href: string;
};

type SearchableProblem = Problem & {
  ratingValue: number;
  titleSearch: string;
  contestSearch: string;
  idSearch: string;
};

const PAGE_SIZE = 100;

const sortLabels: Record<SortKey, string> = {
  idDesc: "Newest",
  idAsc: "Oldest",
  ratingDesc: "Rating high to low",
  ratingAsc: "Rating low to high",
  qAsc: "Q1 to Q4",
  qDesc: "Q4 to Q1"
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value?: string) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function getDueState(value?: string): RevisionItem["dueState"] {
  if (!value) {
    return "upcoming";
  }

  const dueDate = new Date(value);
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);

  if (dueDate < tomorrow) {
    return "due";
  }

  if (dueDate < dayAfterTomorrow) {
    return "tomorrow";
  }

  return "upcoming";
}

function getProblemHref(problem: Problem, progress?: ProblemProgress) {
  if (progress?.customUrl) {
    return progress.customUrl;
  }

  return `https://leetcode.com/problems/${problem.TitleSlug}`;
}

function customProblemFromProgress(progress: ProblemProgress): Problem | null {
  if (!progress.customTitle || !progress.customUrl) {
    return null;
  }

  return {
    ID: progress.problemId,
    Title: progress.customTitle,
    TitleSlug: "",
    Rating: 0,
    ProblemIndex: "Custom",
    ContestTitle: progress.customSource || "Custom"
  };
}

export default function Dashboard({ user }: DashboardProps) {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [progress, setProgress] = useState<Record<number, ProblemProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [contest, setContest] = useState("");
  const [question, setQuestion] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("idDesc");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [page, setPage] = useState(1);
  const [theme, setTheme] = useState("light");
  const [customError, setCustomError] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [openNote, setOpenNote] = useState<{
    title: string;
    note: string;
  } | null>(null);

  const deferredSearch = useDeferredValue(search);
  const deferredContest = useDeferredValue(contest);
  const deferredMinRating = useDeferredValue(minRating);
  const deferredMaxRating = useDeferredValue(maxRating);

  useEffect(() => {
    const savedTheme = localStorage.getItem("leettrack-theme") || "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;

    async function load() {
      try {
        const [problemResponse, progressResponse] = await Promise.all([
          fetch("/api/problems"),
          fetch("/api/progress")
        ]);

        if (!problemResponse.ok || !progressResponse.ok) {
          throw new Error("Could not load dashboard data.");
        }

        const problemData = await problemResponse.json();
        const progressData = await progressResponse.json();
        const progressMap = Object.fromEntries(
          progressData.progress.map((item: ProblemProgress) => [item.problemId, item])
        );

        setProblems(problemData.problems);
        setProgress(progressMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    deferredContest,
    deferredMaxRating,
    deferredMinRating,
    deferredSearch,
    question,
    sort,
    status
  ]);

  const searchableProblems = useMemo<SearchableProblem[]>(() => {
    return problems.map((problem) => ({
      ...problem,
      ratingValue: Number(problem.Rating) || 0,
      titleSearch: problem.Title.toLowerCase(),
      contestSearch: (problem.ContestTitle || problem.ContestID_en || "").toLowerCase(),
      idSearch: String(problem.ID)
    }));
  }, [problems]);

  const problemById = useMemo(
    () => new Map(problems.map((problem) => [problem.ID, problem])),
    [problems]
  );

  const revisionItems = useMemo<RevisionItem[]>(() => {
    return Object.values(progress)
      .filter((item) => item.status === "revision")
      .map((item) => {
        const problem = problemById.get(item.problemId) || customProblemFromProgress(item);
        if (!problem) {
          return null;
        }

        return {
          problem,
          progress: item,
          dueState: getDueState(item.nextReviewAt),
          href: getProblemHref(problem, item)
        };
      })
      .filter((item): item is RevisionItem => Boolean(item))
      .sort((a, b) => {
        const aDate = a.progress.nextReviewAt || "";
        const bDate = b.progress.nextReviewAt || "";
        return aDate.localeCompare(bDate);
      });
  }, [problemById, progress]);

  const dueItems = revisionItems.filter((item) => item.dueState === "due");
  const tomorrowItems = revisionItems.filter((item) => item.dueState === "tomorrow");
  const upcomingItems = revisionItems.filter((item) => item.dueState === "upcoming");

  const stats = useMemo(() => {
    const progressValues = Object.values(progress);
    return {
      total: problems.length,
      solved: progressValues.filter((item) => item.status === "solved").length,
      revision: revisionItems.length,
      due: dueItems.length,
      tomorrow: tomorrowItems.length,
      q1: problems.filter((problem) => problem.ProblemIndex === "Q1").length,
      q2: problems.filter((problem) => problem.ProblemIndex === "Q2").length,
      q3: problems.filter((problem) => problem.ProblemIndex === "Q3").length,
      q4: problems.filter((problem) => problem.ProblemIndex === "Q4").length
    };
  }, [dueItems.length, problems, progress, revisionItems.length, tomorrowItems.length]);

  const filteredProblems = useMemo(() => {
    const min = Number(deferredMinRating) || 0;
    const max = Number(deferredMaxRating) || Number.MAX_SAFE_INTEGER;
    const query = deferredSearch.trim().toLowerCase();
    const contestQuery = deferredContest.trim().toLowerCase();

    const filtered = searchableProblems.filter((problem) => {
      const rowProgress = progress[problem.ID];

      if (problem.ratingValue < min || problem.ratingValue > max) {
        return false;
      }

      if (query && !problem.titleSearch.includes(query) && !problem.idSearch.includes(query)) {
        return false;
      }

      if (contestQuery && !problem.contestSearch.includes(contestQuery)) {
        return false;
      }

      if (question !== "all" && problem.ProblemIndex !== question) {
        return false;
      }

      if (status === "unsolved" && rowProgress) {
        return false;
      }

      if (status === "due") {
        return rowProgress?.status === "revision" && getDueState(rowProgress.nextReviewAt) === "due";
      }

      if (
        (status === "solved" || status === "revision") &&
        rowProgress?.status !== status
      ) {
        return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "ratingAsc":
          return a.ratingValue - b.ratingValue;
        case "ratingDesc":
          return b.ratingValue - a.ratingValue;
        case "idAsc":
          return a.ID - b.ID;
        case "qAsc":
          return a.ProblemIndex.localeCompare(b.ProblemIndex);
        case "qDesc":
          return b.ProblemIndex.localeCompare(a.ProblemIndex);
        case "idDesc":
        default:
          return b.ID - a.ID;
      }
    });
  }, [
    deferredContest,
    deferredMaxRating,
    deferredMinRating,
    deferredSearch,
    progress,
    question,
    searchableProblems,
    sort,
    status
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleProblems = filteredProblems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function setThemeMode(nextTheme: string) {
    setTheme(nextTheme);
    localStorage.setItem("leettrack-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  async function saveProgress(problemId: number, nextStatus?: ProgressStatus, note?: string) {
    const previous = progress;

    if (!nextStatus) {
      const { [problemId]: _removed, ...rest } = progress;
      setProgress(rest);
      const response = await fetch(`/api/progress?problemId=${problemId}`, { method: "DELETE" });
      if (!response.ok) {
        setProgress(previous);
      }
      return;
    }

    const nextProgress: ProblemProgress = {
      ...progress[problemId],
      problemId,
      status: nextStatus,
      note: note ?? progress[problemId]?.note ?? "",
      updatedAt: new Date().toISOString()
    };

    setProgress({ ...progress, [problemId]: nextProgress });

    const response = await fetch("/api/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextProgress)
    });

    if (!response.ok) {
      setProgress(previous);
      return;
    }

    const data = await response.json();
    setProgress((current) => ({ ...current, [problemId]: data.progress }));
  }

  async function reviewProblem(problemId: number, result: "solved" | "again") {
    const previous = progress;
    const response = await fetch("/api/progress/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, result })
    });

    if (!response.ok) {
      setProgress(previous);
      return;
    }

    const data = await response.json();
    setProgress((current) => ({ ...current, [problemId]: data.progress }));
  }

  async function addCustomQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomError("");
    setCustomLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/progress/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") || ""),
        url: String(formData.get("url") || ""),
        source: String(formData.get("source") || "Custom"),
        note: String(formData.get("note") || "")
      })
    });

    const data = await response.json();
    setCustomLoading(false);

    if (!response.ok) {
      setCustomError(data.error || "Could not add custom question.");
      return;
    }

    setProgress((current) => ({ ...current, [data.progress.problemId]: data.progress }));
    event.currentTarget.reset();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function randomUnsolved() {
    const pool = problems.filter((problem) => !progress[problem.ID]);
    if (!pool.length) {
      window.alert("Everything is already tracked. Nice work.");
      return;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    window.open(`https://leetcode.com/problems/${pick.TitleSlug}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LeetTrack Dashboard</p>
          <h1>Practice tracker</h1>
          <p className="muted">Signed in as {user.name}</p>
        </div>

        <div className="topbar-actions">
          <button
            className="ghost-button"
            onClick={() => setThemeMode(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className="ghost-button" onClick={randomUnsolved}>
            Random unsolved
          </button>
          <button className="ghost-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <Stat label="Due today" value={stats.due} tone="red" />
        <Stat label="Due tomorrow" value={stats.tomorrow} tone="amber" />
        <Stat label="Solved" value={stats.solved} tone="green" />
        <Stat label="Revision queue" value={stats.revision} tone="amber" />
        <Stat label="Total problems" value={stats.total} />
        <Stat label="Q1" value={stats.q1} tone="green" />
        <Stat label="Q2" value={stats.q2} tone="blue" />
        <Stat label="Q3" value={stats.q3} tone="amber" />
        <Stat label="Q4" value={stats.q4} tone="red" />
      </section>

      <section className="revision-panel">
        <div className="revision-copy">
          <p className="eyebrow">Anki-style revision</p>
          <h2>{dueItems.length ? "Your revision queue is ready" : "No urgent revision right now"}</h2>
          <p className="muted">
            Add any LeetCode or external problem to Revision. It appears
            tomorrow, then successful reviews move through 2, 4, 8, 16 day
            intervals. After {MAX_SUCCESSFUL_REVIEWS} Got it reviews, it
            graduates out of Anki.
          </p>

          <form className="custom-question-form" onSubmit={addCustomQuestion}>
            <label>
              Custom question
              <input name="title" placeholder="GFG: Maximum path sum" required />
            </label>
            <label>
              Link
              <input name="url" type="url" placeholder="https://..." required />
            </label>
            <div className="custom-form-grid">
              <label>
                Source
                <input name="source" placeholder="GFG" />
              </label>
              <label>
                Note
                <input name="note" placeholder="What went wrong?" />
              </label>
            </div>
            {customError && <p className="error">{customError}</p>}
            <button className="primary-button" disabled={customLoading}>
              {customLoading ? "Adding..." : "Add to revision"}
            </button>
          </form>
        </div>

        <div className="revision-columns">
          <RevisionColumn
            title="Due today"
            items={dueItems}
            onReview={reviewProblem}
            onShowNote={setOpenNote}
          />
          <RevisionColumn
            title="Tomorrow"
            items={tomorrowItems}
            onReview={reviewProblem}
            onShowNote={setOpenNote}
          />
          <RevisionColumn
            title="Upcoming"
            items={upcomingItems.slice(0, 4)}
            onReview={reviewProblem}
            onShowNote={setOpenNote}
          />
        </div>
      </section>

      <section className="filter-panel">
        <div className="filter-grid">
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Problem title or ID" />
          </label>
          <label>
            Contest
            <input value={contest} onChange={(event) => setContest(event.target.value)} placeholder="Weekly Contest 408" />
          </label>
          <label>
            Question
            <select value={question} onChange={(event) => setQuestion(event.target.value)}>
              <option value="all">All questions</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="due">Due revision</option>
              <option value="solved">Solved</option>
              <option value="revision">Needs revision</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {Object.entries(sortLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Min rating
            <input value={minRating} onChange={(event) => setMinRating(event.target.value)} inputMode="numeric" placeholder="0" />
          </label>
          <label>
            Max rating
            <input value={maxRating} onChange={(event) => setMaxRating(event.target.value)} inputMode="numeric" placeholder="4000" />
          </label>
        </div>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <h2>Problems</h2>
            <p className="muted">
              Showing {visibleProblems.length.toLocaleString()} of{" "}
              {filteredProblems.length.toLocaleString()} results
            </p>
          </div>

          {filteredProblems.length > PAGE_SIZE && (
            <div className="pagination">
              <button disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Prev
              </button>
              <span>
                Page {safePage} / {totalPages}
              </span>
              <button disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                Next
              </button>
            </div>
          )}
        </div>

        {loading && <div className="empty-state">Loading live problem data...</div>}
        {error && <div className="empty-state error">{error}</div>}
        {!loading && !error && filteredProblems.length === 0 && (
          <div className="empty-state">No problems match the current filters.</div>
        )}

        {!loading && !error && filteredProblems.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Contest</th>
                  <th>Q</th>
                  <th>Rating</th>
                  <th>Next review</th>
                  <th>Note</th>
                  <th>Review</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleProblems.map((problem) => {
                  const rowProgress = progress[problem.ID];
                  const dueState = getDueState(rowProgress?.nextReviewAt);

                  return (
                    <tr key={problem.ID} className={rowProgress?.status ? `is-${rowProgress.status}` : ""}>
                      <td>
                        <select
                          className="status-select"
                          value={rowProgress?.status || ""}
                          onChange={(event) =>
                            saveProgress(
                              problem.ID,
                              event.target.value ? (event.target.value as ProgressStatus) : undefined
                            )
                          }
                        >
                          <option value="">Unsolved</option>
                          <option value="solved">Solved</option>
                          <option value="revision">Revision</option>
                        </select>
                      </td>
                      <td className="mono">{problem.ID}</td>
                      <td>
                        <strong>{problem.Title}</strong>
                      </td>
                      <td>{problem.ContestTitle || problem.ContestID_en || "-"}</td>
                      <td>
                        <span className={`badge ${String(problem.ProblemIndex).toLowerCase()}`}>
                          {problem.ProblemIndex}
                        </span>
                      </td>
                      <td className="mono">{Math.round(problem.Rating)}</td>
                      <td>
                        {rowProgress?.status === "revision" ? (
                          <span className={`review-pill ${dueState}`}>
                            {dueState === "due" ? "Due now" : formatDate(rowProgress.nextReviewAt)}
                          </span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        <input
                          className="note-input"
                          value={rowProgress?.note || ""}
                          placeholder="Add note"
                          onChange={(event) =>
                            saveProgress(problem.ID, rowProgress?.status || "revision", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        {rowProgress?.status === "revision" ? (
                          <div className="review-actions compact">
                            <button onClick={() => reviewProblem(problem.ID, "solved")}>Got it</button>
                            <button onClick={() => reviewProblem(problem.ID, "again")}>Again</button>
                          </div>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        <a
                          className="problem-link"
                          href={getProblemHref(problem, rowProgress)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openNote && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setOpenNote(null)}
        >
          <section
            className="note-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="note-modal-header">
              <div>
                <p className="eyebrow">Revision note</p>
                <h2 id="note-modal-title">{openNote.title}</h2>
              </div>
              <button className="ghost-button" onClick={() => setOpenNote(null)}>
                Close
              </button>
            </div>
            <p className="note-modal-body">{openNote.note}</p>
          </section>
        </div>
      )}
    </main>
  );
}

function RevisionColumn({
  title,
  items,
  onReview,
  onShowNote
}: {
  title: string;
  items: RevisionItem[];
  onReview: (problemId: number, result: "solved" | "again") => void;
  onShowNote: (note: { title: string; note: string }) => void;
}) {
  return (
    <article className="revision-column">
      <div className="revision-column-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="muted small">Nothing here yet.</p>
      ) : (
        items.map(({ problem, progress, dueState, href }) => (
          <div className={`revision-card ${dueState}`} key={problem.ID}>
            <div>
              <strong>{problem.Title}</strong>
              <p>
                {problem.ContestTitle || "Custom"} | {formatDate(progress.nextReviewAt)} | interval{" "}
                {progress.intervalDays || 1}d | Got it{" "}
                {progress.successfulReviewCount || 0}/{MAX_SUCCESSFUL_REVIEWS}
              </p>
            </div>
            <div className="review-actions">
              <a href={href} target="_blank" rel="noreferrer">
                Open
              </a>
              {progress.note?.trim() && (
                <button
                  className="note-button"
                  onClick={() =>
                    onShowNote({
                      title: problem.Title,
                      note: progress.note?.trim() || ""
                    })
                  }
                >
                  Note
                </button>
              )}
              <button onClick={() => onReview(problem.ID, "solved")}>Got it</button>
              <button onClick={() => onReview(problem.ID, "again")}>Again</button>
            </div>
          </div>
        ))
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "green" | "blue" | "amber" | "red";
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </article>
  );
}
