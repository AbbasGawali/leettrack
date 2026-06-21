import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reviewUserProgress } from "@/lib/store";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const problemId = Number(body?.problemId);
  const result = body?.result as "solved" | "again" | undefined;

  if (
    !Number.isInteger(problemId) ||
    !result ||
    !["solved", "again"].includes(result)
  ) {
    return NextResponse.json(
      { error: "problemId and review result are required." },
      { status: 400 }
    );
  }

  const progress = await reviewUserProgress(user.id, problemId, result);

  if (!progress) {
    return NextResponse.json(
      { error: "This problem is not in your revision queue." },
      { status: 404 }
    );
  }

  return NextResponse.json({ progress });
}
