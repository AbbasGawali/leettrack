import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createCustomRevisionItem } from "@/lib/store";
import { cleanString } from "@/lib/validation";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = cleanString(body?.title).slice(0, 160);
  const url = cleanString(body?.url).slice(0, 500);
  const source = cleanString(body?.source, "Custom").slice(0, 80);
  const note = cleanString(body?.note).slice(0, 500);

  if (!title || !isValidHttpUrl(url)) {
    return NextResponse.json(
      { error: "A title and valid http/https link are required." },
      { status: 400 }
    );
  }

  const progress = await createCustomRevisionItem(user.id, {
    title,
    url,
    source,
    note
  });

  return NextResponse.json({ progress });
}
