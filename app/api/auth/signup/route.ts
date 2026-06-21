import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cleanString, isValidEmail, normalizeEmail } from "@/lib/validation";
import { setSessionCookie, signSession } from "@/lib/auth";
import { createUser, findUserByEmail, isMongoConfigured } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = cleanString(body?.name);
  const email = normalizeEmail(cleanString(body?.email));
  const password = cleanString(body?.password);

  if (!name || !isValidEmail(email) || password.length < 8) {
    return NextResponse.json(
      { error: "Use a name, valid email, and password with at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await createUser({
    name,
    email,
    passwordHash
  });

  const user = {
    id: created.id,
    name: created.name,
    email: created.email
  };

  setSessionCookie(signSession(user));

  return NextResponse.json({ user, storage: isMongoConfigured() ? "mongodb" : "memory" });
}
