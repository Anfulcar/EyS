# Agents' call list: attention counter, order by days waiting, automatic call time — 2026-10-21

**Goal:** Agents know each day what needs attention and in what order; the call time is reliable.
**Who:** Agente de llamadas (and administrators/supervisors who have calls assigned).

## How it works
1. The call form no longer has a date/time field: date and time are recorded automatically on **Guardar**.
2. Red counter on "Mis llamadas" in the menu with the calls that need attention; tabs show their counts.
3. Notice on entering: "Tienes 7 llamadas que requieren atención: 2 seguimientos vencidos, 5 pendientes de hoy."
4. "Para hoy" order: new (never called) first; then by days waiting, longest first.
5. Each card shows "Pendiente hace N días" (from the last call, or from the assignment if never called).
6. Follow-ups that are due are highlighted in yellow with "Seguimiento vencido hace N días" / "Seguimiento hoy".
7. Filter by attempts: Todos · Sin intentos · 1 · 2 · 3 o más.

## Rules
- Needs attention = in "Para hoy" (never called, or a retry / follow-up whose time has come), in campaigns not closed.
- Days are calendar days in Dominican Republic time.

## Approval flow / Notifications
None besides the on-screen counter and notice (no email).

## Existing data
Calls already logged keep their time. Tasks assigned before this change count their waiting days from the last call.

## Decisions I made for you
- Days waiting count from the last call, or from the assignment date for never-called tasks.
- Owner's answer: "time of the call" = the date and time of day, recorded on save (no duration).

## Not included
- Email or phone notifications. (Manager side: call review, export choices, clickable dashboard — next pull request.)

## Manual changes
- "Mis llamadas" and "Registrar una llamada" sections; "What's new" line.

## How to test it in the demo
1. Sign in as `demo.agente1`: red counter in the menu, yellow notice, tab counts.
2. "Para hoy": "Nueva" tasks first, "Pendiente hace N días", one follow-up highlighted in yellow.
3. Click "Sin intentos" / "1" / "3 o más".
4. Log a call: there is no time field; the history shows the time it was saved.
