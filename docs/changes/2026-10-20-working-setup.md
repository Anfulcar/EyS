# Working setup like IBC Flow — 2026-10-20

**Goal:** Work on EyS the same way as on IBC Flow: same way of working with the owner, same GitHub and
Vercel automation, same security habits. What the app does stays the same.
**Who:** the owner (process manager) approves changes; Claude implements them through pull requests.

## How it works (one pull request per step, merged in order)
1. Working rules: `CLAUDE.md`, change-request skill, this folder, pull-request template, `.env.example` with names only.
2. Automatic quality check on GitHub: type check, lint, tests, production build, browser test of the main journey.
3. Vercel hardening: security headers, `/api/health`, "can't reach the server" message, "not found" for
   anything a person may not see, README guide to every Vercel setting.
4. Demo mode for preview sites (separate demo database, sample people for every role, reloaded on each deploy).
5. Activity log and error log, visible to administrators.
6. Password asked again for sensitive actions after 10 minutes.
7. In-app manual (`/help`) with "What's new".

## Decisions by the owner
- Two-step verification: **not added** (keep sign-in as it is).
- Starting password `<username>123`: **kept as it is**.

## Decisions I made for you
- No scheduled daily job (Vercel Cron): follow-up and retry dates are worked out when lists open.
- Each step is its own branch and pull request, each built on the previous one; merge them in order.

## Not included
- Two-step verification; email notifications; any change to what the app does.

## How to test it
Each pull request lists its own checks and how to try it on its preview site.
