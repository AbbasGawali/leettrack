# LeetTrack

A multi-user Next.js dashboard for tracking LeetCode practice progress using the Zerotrac problem rating dataset.

## Features

- Email/password signup and login with HTTP-only JWT cookies.
- MongoDB Atlas persistence for users and per-user progress.
- Development fallback storage when `MONGODB_URI` is not configured, so the app can be tried locally before Atlas is connected.
- Live problem data fetched from `https://zerotrac.github.io/leetcode_problem_rating/data.json`.
- Search, contest search, question filter, solved/revision filter, rating range, and sorting.
- Solved and "Needs Revision" states with optional notes.
- Anki-style revision reminders: new revision items are due tomorrow, then successful reviews move through 2, 4, 8, 16 day intervals and keep doubling. After 15 successful "Got it" reviews, the problem graduates out of Anki.
- Random unsolved problem launcher.
- Light/dark theme with responsive dashboard UI.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your MongoDB Atlas URL and JWT secret:

   ```bash
   cp .env.example .env.local
   ```

   Without `MONGODB_URI`, login/signup still work in development using in-memory storage. Data resets when the dev server restarts.

3. Run the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## MongoDB Collections

The app creates these collections automatically:

- `users`: account records with hashed passwords.
- `progress`: one document per user/problem containing `status` and `note`.

Indexes are created lazily by the database helper.
