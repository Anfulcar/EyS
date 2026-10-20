# Call review, export with choices, clickable dashboards — 2026-10-21

**Goal:** Managers can check every call after it is made, take out exactly the data they need, and see who is behind each dashboard number.
**Who:** Administrador and Supervisor (review, export, dashboards); Agente (sees their own calls and review comments).

## How it works
1. New menu item **"Llamadas realizadas"** (agents, supervisors, administrators): every call with date and time, agent, establishment, number dialed and result. Filters: campaign, dates, agent, result, "Sin revisar" / "Revisada".
2. Clicking a call opens its **summary**: who answered and their role, whether they are the person in charge, the answers per establishment, the commitment date, the obstacle, the notes and WhatsApp.
3. Supervisors and administrators press **"Marcar como revisada"**, with an optional comment, and can update it later. The agent sees "Revisada por … · date" and the comment in "Llamadas realizadas" and in the task's call history.
4. **Exportar**: tick the sheets (Matriz, Llamadas, Teléfonos, Visitas, Cambios de estatus) and, under "Elegir columnas", the columns of each. Filters: dates, assigned agent, zone, priority, result and task status. "Descargar Excel" gets only what was chosen. The last choice is remembered in that browser. The "Llamadas" sheet also has the review columns.
5. **Dashboards** (each campaign and global statistics): every number, bar, legend and table row opens the list of establishments behind it (for example "Requieren visita"), with agent and last result, and a "Descargar (Excel)" button.

## Rules
- Agents see only their own calls. Opening someone else's call answers "not found".
- Only supervisors and administrators can review. The server checks the role, not only the screen.
- A saved call can't be edited by anyone; only the review is added.
- Export, dashboard lists and their downloads are for supervisors and administrators only. The server checks this too.
- Export dates filter calls, visits and status changes; the other filters apply to establishments.

## Approval flow / Notifications
None. Reviews are visible on screen; no email.

## Existing data
Calls already logged show as "Sin revisar". The old full-export link still downloads everything.

## Decisions I made for you
- The last export choice is remembered per browser (not per user).
- The dashboard lists use exactly the same rules as the numbers, so the count always matches.
- The agent filter in the export means the agent assigned to the task.

## Not included
- Call recordings (no phone-system integration).
- Editing a saved call.

## Manual changes
- New "Llamadas realizadas y revisión" section. "Campañas" (Exportar) and "Tableros" updated. "What's new" line.

## How to test it in the demo
1. `demo.supervisor` → "Llamadas realizadas": two calls already "Revisada" (one with a comment). Open a "Sin revisar" one, write a comment, then press "Marcar como revisada".
2. `demo.agente1` → "Llamadas realizadas": only their calls; open the reviewed one and see the comment, also in "Abrir la tarea" → history.
3. `demo.supervisor` → Campañas → campaign → Tablero: click "Requieren visita" (or any number or bar) → list → "Descargar (Excel)".
4. Exportar: untick "Visitas", open "Elegir columnas" on Matriz and untick some columns, pick a zone → "Descargar Excel".
