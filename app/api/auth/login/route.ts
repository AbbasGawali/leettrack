import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { setSessionCookie, signSession } from "@/lib/auth";
import { findUserByEmail, isMongoConfigured } from "@/lib/store";
import { cleanString, normalizeEmail } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(cleanString(body?.email));
  const password = cleanString(body?.password);

  const user = await findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email
  };

  setSessionCookie(signSession(sessionUser));

  return NextResponse.json({
    user: sessionUser,
    storage: isMongoConfigured() ? "mongodb" : "memory"
  });
}
