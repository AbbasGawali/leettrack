import { PROBLEMS_URL } from "@/lib/constants";
import type { Problem } from "@/types/problem";

export async function fetchProblems(): Promise<Problem[]> {
  const response = await fetch(PROBLEMS_URL, {
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) {
    throw new Error("Unable to load problem ratings.");
  }

  const raw = (await response.json()) as Problem[];

  return raw.map((problem) => ({
    ...problem,
    ContestTitle: problem.ContestID_en || problem.ContestTitle || "-"
  }));
}
