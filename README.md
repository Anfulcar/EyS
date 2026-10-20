# EyS – Campañas de Formalización

Web app for running call campaigns from the *Plan de Formalización* and its *Matriz de seguimiento*:
agents see their assigned calls, record each call with the guided script (codes 01–10), add or replace phone numbers,
and managers upload establishments, assign them, track email/visits/SIGTUR status and get dashboards and exports.
UI in Spanish and English.

Stack: Next.js 15 (App Router) · Turso (libSQL/SQLite) with Drizzle ORM · local username/password users · Tailwind · ExcelJS.

## Roles

| Role | Can do |
|---|---|
| **admin** | Everything: users, campaigns, uploads, assignment, dashboards, exports |
| **supervisor** | Campaigns (except create/delete/settings), uploads, assignment, visits, dashboards, exports |
| **agent** | Only "Mis llamadas": the companies assigned to them in active campaigns within their dates |
| **inspector** | Only "Visitas": pending field visits, register V1–V7, download route sheet |

## How the call workflow works (plan §5.4–5.5, §6)

- One **call task per RUT** (establishment). Tasks sharing an *RNC / Cédula* are shown as "same company": the agent can tick them and log one call for all of them, and automatic assignment keeps them with the same agent.
- Agents can **add a number** as *additional* or *substitute* (the replaced number is kept in history), always with a reason.
- No contact (07–10): retry next business day (10 → 3 hours later); WhatsApp reminder after the 2nd failure;
  after the campaign's max attempts (default 3), or when no working number remains, the company goes **to visit**.
- Contact: 01 requires a commitment date → follow-up call *N* business days after it (default 5);
  03 → follow-up or visit; 04 → visit; 06 → call again next day; 02/05 → done.
- Visits: V1/V2/V7 schedule a phone follow-up; V5/V6 allow a 2nd visit.
- SIGTUR status uploads mark who moved to *En proceso* and set "Canal que logró la gestión".

## Local development

```bash
cp .env.example .env.local     # edit AUTH_SECRET and ADMIN_PASSWORD
npm install
npm run db:migrate             # creates local.db and the first admin user
npm run dev                    # http://localhost:3000
```

Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
Migrations run automatically on every build (`npm run build` → `scripts/migrate.mjs`).

## Checks (run before every push; GitHub runs the same on every pull request)

```bash
npm ci
npm run typecheck   # type check
npm run lint        # code style and common mistakes
npm test            # rule tests (call workflow, upload, dates) on a throw-away database
npm run build       # same production build as Vercel
npm run test:e2e    # browser test of the main journey (Playwright, made-up data)
```

## Settings in Vercel (environment variables)

Every setting is read from environment variables; nothing secret is stored in the code or the repository.
`.env.example` lists the names. Values are set **only** in Vercel.

**Where:** Vercel → your project → **Settings** → **Environment Variables** → *Add New*. For each variable,
type the **Key** (name), paste the **Value**, tick the **Environments** shown below, and click **Save**.
Changes apply to the **next** deployment: Deployments → ⋯ on the latest one → **Redeploy**.

| Key | Environments | What to paste | Where to get it |
|---|---|---|---|
| `TURSO_DATABASE_URL` | Production | `libsql://…` address of the **live** database | Turso dashboard → Databases → your database → copy the URL (or `turso db show <name> --url`) |
| `TURSO_AUTH_TOKEN` | Production | access token of the live database | Turso dashboard → your database → **Generate Token** (or `turso db tokens create <name>`) |
| `AUTH_SECRET` | Production **and** Preview (different values) | a long random text that signs sign-in sessions | Generate one at https://generate-secret.vercel.app/32 or with `openssl rand -base64 32` |
| `ADMIN_USERNAME` | Production | first administrator's username, e.g. `admin` | You choose it |
| `ADMIN_PASSWORD` | Production | temporary password for the first administrator (8+ characters) | You choose it; it must be changed at first sign-in. You can delete it after the first sign-in |
| `ADMIN_NAME` | Production | display name (optional) | You choose it |

Rules:
- **Never** paste these values anywhere else (code, chat, email, documents). If one leaks, create a new one
  (new token in Turso / new `AUTH_SECRET`), replace it in Vercel and redeploy.
- **Preview** deployments (one per pull request) must never use the live database.

## Health check

`/api/health` answers `{"status":"ok","database":"ok"}` when the app and its database are reachable, or
HTTP 503 when the database can't be reached. Use it to check a deployment or with an uptime monitor.

## Deploy (Vercel + Turso)

1. **Turso**: create a database and a token.
   ```bash
   turso db create eys-campanas
   turso db show eys-campanas --url        # TURSO_DATABASE_URL
   turso db tokens create eys-campanas     # TURSO_AUTH_TOKEN
   ```
2. **Vercel** → Add New Project → import this GitHub repo (framework: Next.js, defaults are fine).
3. Environment variables (Production):

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
   | `TURSO_AUTH_TOKEN` | token from step 1 |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `ADMIN_USERNAME` | first admin username, e.g. `admin` |
   | `ADMIN_PASSWORD` | temporary password (8+ characters); you must change it at first login |
   | `ADMIN_NAME` | display name (optional) |

4. Deploy. The build applies migrations and creates the admin user (only when the users table is empty).
   After the first login you can delete `ADMIN_PASSWORD` from Vercel.

Uploads are limited to ~4 MB per file (Vercel's request limit); the full Matriz (1,083 rows) is ~350 KB.
