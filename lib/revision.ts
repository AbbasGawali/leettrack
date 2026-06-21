import type { ProblemProgress } from "@/types/problem";

export const MAX_SUCCESSFUL_REVIEWS = 15;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return next;
}

export function createInitialRevisionSchedule(existing?: ProblemProgress) {
  if (existing?.status === "revision" && existing.nextReviewAt) {
    return {
      intervalDays: existing.intervalDays || 1,
      nextReviewAt: existing.nextReviewAt,
      lastReviewedAt: existing.lastReviewedAt,
      reviewCount: existing.reviewCount || 0,
      successfulReviewCount: existing.successfulReviewCount || 0
    };
  }

  return {
    intervalDays: 1,
    nextReviewAt: addDays(new Date(), 1).toISOString(),
    reviewCount: 0,
    successfulReviewCount: 0
  };
}

export function advanceRevisionSchedule(
  existing: ProblemProgress | undefined,
  result: "solved" | "again"
) {
  const now = new Date();

  if (result === "again") {
    return {
      intervalDays: 1,
      nextReviewAt: addDays(now, 1).toISOString(),
      lastReviewedAt: now.toISOString(),
      reviewCount: (existing?.reviewCount || 0) + 1,
      successfulReviewCount: existing?.successfulReviewCount || 0
    };
  }

  const currentInterval = existing?.intervalDays || 1;
  const nextInterval = currentInterval === 1 ? 2 : currentInterval * 2;
  const successfulReviewCount = (existing?.successfulReviewCount || 0) + 1;

  return {
    intervalDays: nextInterval,
    nextReviewAt: addDays(now, nextInterval).toISOString(),
    lastReviewedAt: now.toISOString(),
    reviewCount: (existing?.reviewCount || 0) + 1,
    successfulReviewCount
  };
}

export function isRevisionMastered(successfulReviewCount = 0) {
  return successfulReviewCount >= MAX_SUCCESSFUL_REVIEWS;
}
