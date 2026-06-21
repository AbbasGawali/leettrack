import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { AUTH_COOKIE, COOKIE_MAX_AGE } from "@/lib/constants";
import { findUserById } from "@/lib/store";
import type { SessionUser } from "@/types/problem";

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "development-only-change-me";
    }

    throw new Error("Missing JWT_SECRET. Add it to .env.local.");
  }
  return secret;
}

export function signSession(user: SessionUser) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
}

export function setSessionCookie(token: string) {
  cookies().set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
}

export function clearSessionCookie() {
  cookies().delete(AUTH_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as TokenPayload;
    const user = await findUserById(payload.sub);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  } catch {
    return null;
  }
}
