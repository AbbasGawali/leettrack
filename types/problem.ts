export type Problem = {
  Rating: number;
  ID: number;
  Title: string;
  TitleZH?: string;
  TitleSlug: string;
  ContestSlug?: string;
  ProblemIndex: "Q1" | "Q2" | "Q3" | "Q4" | string;
  ContestID_en?: string;
  ContestID_zh?: string;
  ContestTitle?: string;
};

export type ProgressStatus = "solved" | "revision";

export type ProblemProgress = {
  problemId: number;
  status: ProgressStatus;
  note?: string;
  customTitle?: string;
  customUrl?: string;
  customSource?: string;
  intervalDays?: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  reviewCount?: number;
  successfulReviewCount?: number;
  masteredAt?: string;
  updatedAt: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};
