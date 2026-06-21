"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthFormProps = {
  mode: "login" | "signup";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || "")
    };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">LeetTrack</p>
          <h1>{isSignup ? "Create your tracker" : "Welcome back"}</h1>
          <p className="muted">
            Track solved problems, revision queues, ratings, and contest
            progress from one clean dashboard.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label>
              Name
              <input name="name" type="text" placeholder="Ada Lovelace" required />
            </label>
          )}

          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="switch-auth">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Log in" : "Create one"}
          </Link>
        </p>
      </section>

      <section className="auth-showcase" aria-hidden="true">
        <div className="mini-window">
          <div className="mini-window-header">
            <span />
            <span />
            <span />
          </div>
          <div className="mini-stats">
            <div>
              <strong>392</strong>
              <small>Solved</small>
            </div>
            <div>
              <strong>47</strong>
              <small>Revision</small>
            </div>
          </div>
          <div className="mini-row hot" />
          <div className="mini-row" />
          <div className="mini-row cool" />
        </div>
      </section>
    </main>
  );
}
