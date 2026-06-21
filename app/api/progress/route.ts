import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteUserProgress,
  getUserProgress,
  upsertUserProgress
} from "@/lib/store";
import type { ProgressStatus } from "@/types/problem";

const statuses: ProgressStatus[] = ["solved", "revision"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getUserProgress(user.id);

  return NextResponse.json({ progress: rows });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const problemId = Number(body?.problemId);
  const status = body?.status as ProgressStatus | undefined;
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : "";

  if (!Number.isInteger(problemId) || !status || !statuses.includes(status)) {
    return NextResponse.json(
      { error: "problemId and a valid status are required." },
      { status: 400 }
    );
  }

  const progress = await upsertUserProgress(user.id, {
    problemId,
    status,
    note
  });

  return NextResponse.json({
    progress
  });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const problemId = Number(searchParams.get("problemId"));
  await deleteUserProgress(
    user.id,
    Number.isInteger(problemId) ? problemId : undefined
  );

  return NextResponse.json({ ok: true });
}
