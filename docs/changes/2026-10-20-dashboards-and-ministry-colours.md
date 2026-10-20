# Cleaner dashboards and Ministry colours — 2026-10-20

**Goal:** Dashboards that show at a glance how the plan is going, and an app that looks like the
Ministerio de Turismo (logo and colours).
**Who:** Administrador and Supervisor see the dashboards; everyone sees the new colours and logo.

## How it works
1. The Ministerio de Turismo logo appears in the menu and on the sign-in page.
2. The whole app uses the logo's colours: deep blue for menu, buttons and links; green for good results
   (commitment, already applied, done); yellow/orange for in-progress (retry, follow-up, visit); red for problems
   (refuses, closed, wrong number, out of service).
3. Campaign dashboard and "Estadísticas globales":
   - Top row: the 4 key goals of the plan, each with a progress bar against its target (green when met,
     orange when not): Llamados al menos 1 vez (100 %), Contacto efectivo (≥ 65 %), Compromisos (≥ 70 %),
     Vencidas → En proceso (≥ 80 %).
   - A second, smaller row with the other goals (compliance of commitments, with a result, no license → applied,
     notified by any channel).
   - One strip with the counts (universe, calls, closed, need a visit, emails sent, bounced) and the period progress.
   - Charts: results, calls per day, tasks by status, SIGTUR status and channel.
   - Tables (by agent, zone, priority, subsector) in tabs: one open at a time.

## Rules
- No calculation changes: same numbers and targets as before.

## Approval flow / Notifications
None.

## Existing data
Untouched.

## Decisions I made for you
- Logo taken from the image the owner sent, trimmed of its white margin.
- Colours: blue #0B4A92, yellow #F5C400, orange #F39019, red #D81E1E, green #2E9E44 (from the logo).
- "Empresas por estado" renamed "Tareas por estado" (tasks are per RUT since October).

## Not included
- Changes to the Excel exports' look.

## Manual changes
- "Tableros" section updated; "What's new" line added.

## How to test it in the demo
1. Open the preview site: the logo is on the sign-in page and in the menu.
2. Sign in as `demo.admin` → open "Campaña demo" → Tablero: 4 goal cards on top, one counts strip,
   charts, then tabs "Por agente / Por zona / Por prioridad / Por subsector".
3. "Estadísticas globales" uses the same layout.
4. As `demo.agente1`, buttons and statuses use the Ministry colours.
