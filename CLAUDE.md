# How to work on this repository

App: **EyS – Campañas de Formalización**, a call-campaign app (call agents, field inspectors, supervisors,
administrators) built from the *Plan de Formalización Región Este* and its *Matriz de seguimiento*.
Technical overview: `README.md`.

## The owner

- The owner is a **process and project manager, not a developer**.
- Talk in terms of **processes, roles, rules and what users see** (screens, buttons, lists, reports, files).
- **Never ask the owner technical questions** (libraries, databases, code structure, frameworks, hosting
  internals). Decide them yourself and state the decision in one line, e.g. "Decided: follow-up dates are
  calculated when the list opens, so no scheduled job is needed."
- Write to the owner in the language they write in (usually English or Spanish). The app UI is bilingual (ES/EN).

## Change requests

- **Every request to change the app** (feature, fix, rule, report, roles, notifications, data) goes through
  the `change-request` skill in `.claude/skills/change-request/SKILL.md`.
- Questions about the app, explanations or analysis don't need the skill.
- Small, obvious fixes (a typo, a broken button) can skip the questions, but still get a short brief.
- Every approved brief is saved in `docs/changes/<YYYY-MM-DD>-<short-name>.md` **in the same pull request**.

## Reporting back after a change

Always include, in plain language:
1. **What changed for each role** (Administrador, Supervisor, Agente, Inspector).
2. A **✅ / ❌ list** of each thing the owner can check.
3. **How to try it** (which preview site, which demo user, which steps).
4. **Anything not done** and why.
5. The **pull-request link**.

## GitHub workflow

- **Never push to `main`.** Work on a branch and open a pull request for the owner to merge.
- If the previous pull request is **already merged**, start a fresh branch from the latest `main` and open a
  new pull request. If it is **still open**, add to it and update its title and description.
- Pull-request description (template in `.github/pull_request_template.md`):
  1. **What changes for people**, in plain language, per role.
  2. **Checks**: what was run and the results, plus the security review (below).
- Before **every push**, run the same checks as GitHub Actions and never push something known to fail:
  ```bash
  npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
  ```
- If the GitHub check fails after a push: find the cause and fix it. **Never skip, disable or weaken tests.**

## Manual

- The in-app manual (`/help`) must be updated **in the same pull request** for every change that alters what
  people see or do, with a dated line in its **"What's new" / "Novedades"** section.

## Security habits (always)

- Passwords, keys and tokens go **only in Vercel → Settings → Environment Variables**. Never in code, the
  repository, commit messages or the conversation.
- If the owner pastes a secret by mistake: **don't use it, don't save it**, and tell them to revoke it and
  create a new one.
- When a new key is needed, tell the owner exactly where to get it and where to paste it in Vercel.
- `.env` files are never committed (they are in `.gitignore`); `.env.example` lists **names only**.
- **Before each pull request**, review the diff for:
  1. secrets (keys, tokens, passwords, connection strings);
  2. permission checks done only on screen: every action and download must also check the role on the
     server, and items a person can't see must answer "not found";
  3. personal data (names, phones, emails, addresses) shown to people who shouldn't see it.
  Report what was checked in the pull request under "Checks".
- Ask the owner **before changing how people sign in**.

## App rules worth knowing

- Roles: `admin`, `supervisor`, `agent`, `inspector` (server-side checks in `src/lib/auth.ts`).
- One call task per **RUT**; tasks with the same **RNC** are "same company" and can be worked together.
- Call results 01–10 and visit results V1–V7 are stored as codes but **shown as text only**.
- Starting password for new users is `<username>123`, changed at first sign-in (owner's decision).
- Two-step verification is **not** used (owner's decision, 2026-10-20).
