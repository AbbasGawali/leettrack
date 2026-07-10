import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  advanceRevisionSchedule,
  createInitialRevisionSchedule,
  isRevisionMastered
} from "@/lib/revision";
import type { ProblemProgress, ProgressStatus } from "@/types/problem";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type MemoryStore = {
  users: UserRecord[];
  progress: Array<ProblemProgress & { userId: string }>;
};

const globalForStore = globalThis as typeof globalThis & {
  _leettrackMemoryStore?: MemoryStore;
};

function getMemoryStore() {
  if (!globalForStore._leettrackMemoryStore) {
    globalForStore._leettrackMemoryStore = {
      users: [],
      progress: []
    };
  }

  return globalForStore._leettrackMemoryStore;
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (!isMongoConfigured()) {
    return getMemoryStore().users.find((user) => user.email === email) || null;
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash
  };
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!isMongoConfigured()) {
    return getMemoryStore().users.find((user) => user.id === id) || null;
  }

  if (!ObjectId.isValid(id)) {
    return null;
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash
  };
}

export async function createUser(user: Omit<UserRecord, "id">): Promise<UserRecord> {
  if (!isMongoConfigured()) {
    const created = {
      ...user,
      id: crypto.randomUUID()
    };
    getMemoryStore().users.push(created);
    return created;
  }

  const db = await getDb();
  const result = await db.collection("users").insertOne({
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return {
    ...user,
    id: result.insertedId.toString()
  };
}

export async function getUserProgress(userId: string): Promise<ProblemProgress[]> {
  if (!isMongoConfigured()) {
    return getMemoryStore().progress
      .filter((item) => item.userId === userId)
      .map(({ userId: _userId, ...item }) => item);
  }

  const db = await getDb();
  const rows = await db
    .collection("progress")
    .find({ userId: new ObjectId(userId) })
    .project({ _id: 0, userId: 0 })
    .toArray();

  return rows.map((row) => ({
    problemId: row.problemId,
    status: row.status,
    note: row.note,
    customTitle: row.customTitle,
    customUrl: row.customUrl,
    customSource: row.customSource,
    intervalDays: row.intervalDays,
    nextReviewAt:
      row.nextReviewAt instanceof Date ? row.nextReviewAt.toISOString() : row.nextReviewAt,
    lastReviewedAt:
      row.lastReviewedAt instanceof Date
        ? row.lastReviewedAt.toISOString()
        : row.lastReviewedAt,
    reviewCount: row.reviewCount || 0,
    successfulReviewCount: row.successfulReviewCount || 0,
    masteredAt:
      row.masteredAt instanceof Date ? row.masteredAt.toISOString() : row.masteredAt,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
  }));
}

export async function getSingleUserProgress(
  userId: string,
  problemId: number
): Promise<ProblemProgress | undefined> {
  const rows = await getUserProgress(userId);
  return rows.find((row) => row.problemId === problemId);
}

export async function upsertUserProgress(
  userId: string,
  progress: Omit<ProblemProgress, "updatedAt"> & { updatedAt?: string }
): Promise<ProblemProgress> {
  const updatedAt = new Date();
  const existing = await getSingleUserProgress(userId, progress.problemId);
  const revisionSchedule =
    progress.status === "revision"
      ? createInitialRevisionSchedule(existing)
      : {};
  const nextProgress = {
    problemId: progress.problemId,
    status: progress.status,
    note: progress.note || "",
    customTitle: progress.customTitle,
    customUrl: progress.customUrl,
    customSource: progress.customSource,
    ...revisionSchedule,
    updatedAt: updatedAt.toISOString()
  };

  if (!isMongoConfigured()) {
    const store = getMemoryStore();
    const index = store.progress.findIndex(
      (item) => item.userId === userId && item.problemId === progress.problemId
    );
    const memoryRow = { ...nextProgress, userId };

    if (index >= 0) {
      store.progress[index] = memoryRow;
    } else {
      store.progress.push(memoryRow);
    }

    return nextProgress;
  }

  const db = await getDb();
  await db.collection("progress").updateOne(
    { userId: new ObjectId(userId), problemId: progress.problemId },
    {
      $set: {
        userId: new ObjectId(userId),
        problemId: progress.problemId,
        status: progress.status,
        note: progress.note || "",
        customTitle: progress.customTitle,
        customUrl: progress.customUrl,
        customSource: progress.customSource,
        ...revisionSchedule,
        updatedAt
      },
      $unset: {
        ...(progress.status === "solved"
          ? {
              intervalDays: "",
              nextReviewAt: "",
              lastReviewedAt: "",
              reviewCount: "",
              successfulReviewCount: "",
              masteredAt: ""
            }
          : {})
      }
    },
    { upsert: true }
  );

  return nextProgress;
}

export async function createCustomRevisionItem(
  userId: string,
  input: {
    title: string;
    url: string;
    source?: string;
    note?: string;
  }
): Promise<ProblemProgress> {
  const problemId = -Math.floor(Date.now() + Math.random() * 1000);

  return upsertUserProgress(userId, {
    problemId,
    status: "revision",
    note: input.note || "",
    customTitle: input.title,
    customUrl: input.url,
    customSource: input.source || "Custom"
  });
}

export async function reviewUserProgress(
  userId: string,
  problemId: number,
  result: "solved" | "again"
): Promise<ProblemProgress | null> {
  const existing = await getSingleUserProgress(userId, problemId);

  if (!existing || existing.status !== "revision") {
    return null;
  }

  const schedule = advanceRevisionSchedule(existing, result);
  const mastered = result === "solved" && isRevisionMastered(schedule.successfulReviewCount);
  const nextStatus: ProgressStatus = mastered ? "solved" : existing.status;
  const masteredAtDate = mastered ? new Date() : undefined;
  const masteredAt = masteredAtDate?.toISOString() || existing.masteredAt;
  const nextProgress = {
    ...existing,
    ...schedule,
    status: nextStatus,
    masteredAt,
    updatedAt: new Date().toISOString()
  };

  if (!isMongoConfigured()) {
    const store = getMemoryStore();
    const index = store.progress.findIndex(
      (item) => item.userId === userId && item.problemId === problemId
    );

    if (index >= 0) {
      store.progress[index] = { ...nextProgress, userId };
    }

    return nextProgress;
  }

  const db = await getDb();
  await db.collection("progress").updateOne(
    { userId: new ObjectId(userId), problemId },
    {
      $set: {
        status: nextProgress.status,
        ...(mastered
          ? {}
          : {
              intervalDays: schedule.intervalDays,
              nextReviewAt: new Date(schedule.nextReviewAt)
            }),
        lastReviewedAt: new Date(schedule.lastReviewedAt),
        reviewCount: schedule.reviewCount,
        successfulReviewCount: schedule.successfulReviewCount,
        ...(masteredAtDate ? { masteredAt: masteredAtDate } : {}),
        updatedAt: new Date(nextProgress.updatedAt)
      },
      $unset: {
        ...(mastered
          ? {
              intervalDays: "",
              nextReviewAt: ""
            }
          : {})
      }
    }
  );

  return nextProgress;
}

export async function deleteUserProgress(userId: string, problemId?: number) {
  if (!isMongoConfigured()) {
    const store = getMemoryStore();
    store.progress = store.progress.filter((item) => {
      if (item.userId !== userId) {
        return true;
      }

      return Number.isInteger(problemId) ? item.problemId !== problemId : false;
    });
    return;
  }

  const db = await getDb();

  if (Number.isInteger(problemId)) {
    await db.collection("progress").deleteOne({
      userId: new ObjectId(userId),
      problemId
    });
    return;
  }

  await db.collection("progress").deleteMany({
    userId: new ObjectId(userId)
  });
}
