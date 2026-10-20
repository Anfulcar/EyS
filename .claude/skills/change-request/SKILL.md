---
name: change-request
description: Use for EVERY request to change the EyS campaign app — new feature, fix, business rule, report, roles/permissions, notifications or data changes. Turns the owner's request into a scored, approved change brief before any code is written. Not needed for questions, explanations or analysis.
---

# Change request

The owner is a process manager, not a developer. Speak in processes, roles, rules and screens.
Never ask technical questions: decide them and state the decision in one line.

## a) Read what it touches

Before answering, read the parts of the app the request touches: the screens (`src/app/**/page.tsx`),
the rules (`src/lib/workflow.ts`, `src/lib/catalog.ts`, `src/lib/stats.ts`, `src/lib/importer.ts`),
the server actions (`src/app/actions.ts`), roles (`src/lib/auth.ts`), the manual (`/help`) and earlier briefs in
`docs/changes/`. Know what happens **today** before proposing what should happen.

## b) Score the request

Mark each item **Clear**, **Assumed** (write the safest default you will use) or **Missing**:

| # | Item | What to establish |
|---|---|---|
| 1 | Goal | Why: the problem or result the owner wants |
| 2 | Who does / who sees | Which roles act, which roles see the result (Administrador, Supervisor, Agente, Inspector) |
| 3 | What starts it | The trigger: a button, an upload, a call result, a date, a status change |
| 4 | Today vs. wanted | What happens now, step by step, and what should happen |
| 5 | Rules and exceptions | Conditions, limits, dates, counts, special cases |
| 6 | Effect on approvals | Does anything need someone's approval? (Today the app has no approval steps.) Nobody approves their own request |
| 7 | Information fields | New or changed fields, lists, columns in uploads/exports |
| 8 | Notifications | Who is told what, where (screen, badge, email) |
| 9 | Existing data | What happens to campaigns, tasks, calls and visits already loaded |
| 10 | Edge cases | Missing phone, same company (RNC), closed campaign, re-upload, reassignment |
| 11 | How the owner checks it's done | Concrete checks in the demo site |
| 12 | Not included | What this change deliberately leaves out |

Show the score to the owner as a short table.

## c) Ask only about what's Missing

- **At most 4 questions at a time**, in plain language.
- Each question has **2–4 concrete options**, **your recommendation first**, marked "(recommended)".
- Use real examples from the organization: e.g. "Tasks of DEPORTES MARINOS PROFESIONALES (16 establishments,
  same RNC)…", zones like "A1 Bávaro – Punta Cana", results like "No contesta" or "Cerró operaciones",
  roles like "Agente de llamadas".
- If nothing is Missing, skip straight to the brief.

## d) Write the change brief and wait for "go"

Use this structure (keep it short):

```markdown
# <Title> — <YYYY-MM-DD>

**Goal:** …
**Who:** does … / sees …

## How it works
1. …
2. …

## Rules
- …

## Approval flow
None / … (nobody approves their own request)

## Notifications
None / …

## Existing data
…

## Decisions I made for you
- … (one line each, including technical decisions)

## Not included
- …

## Manual changes
- Help page sections to update + "What's new" line

## How to test it in the demo
1. Open the preview site, sign in as `demo.agente` …
2. …
```

**Wait for the owner's "go"** before writing code. Small obvious fixes (typo, broken button) can skip the
questions but still get a short brief.

## e) Save the approved brief

Save it as `docs/changes/<YYYY-MM-DD>-<short-name>.md` (date of approval, kebab-case name) in the
**same pull request** as the change. Update it if the owner changes their mind during the work.

## Then build it

Follow `CLAUDE.md`: branch + pull request, update the manual (`/help` + "What's new"), run all checks before
pushing, security review, and report back with: what changed per role, ✅/❌ checks, how to try it, anything
not done, pull-request link.
