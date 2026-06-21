import { NextResponse } from "next/server";
import { fetchProblems } from "@/lib/problems";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const problems = await fetchProblems();
    return NextResponse.json({ problems });
  } catch {
    return NextResponse.json(
      { error: "Could not fetch the latest problem data." },
      { status: 502 }
    );
  }
}
