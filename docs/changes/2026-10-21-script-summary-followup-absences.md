# Script, Resumen, Seguimiento, assignment by workload and absences — 2026-10-21

**Goal:** you control what agents say, everyone understands the labels, and work is shared fairly, including when someone is off.
**Who:**
- Administrators and supervisors: edit the script, assign, and use "Seguimiento".
- Only administrators record absences. Supervisors see them.
- Agents see the campaign's script.

## How it works
1. **Call script per campaign:** campaign → "Configuración" → "Guion de llamada" (Spanish; English optional). Existing campaigns start with today's text. Agents see their campaign's script in each task.
2. **"Resumen" tab:**
   - the Matriz indicator table for this campaign (Vencidas / Sin licencia / Total), calculated live;
   - the legend: P1–P3, call results, visit results, SIGTUR statuses, channels and task statuses, with what each means.
3. **Assignment** ("Asignar tareas"):
   - **the same panel and steps as before** (method, who takes part, zones, scope);
   - added: each person's current load ("N abiertos"), an "Ausente" tag (unticked by default, still selectable), and **"Considerar la carga actual de cada persona"** (on by default);
   - with that option, an even split gives more to whoever has less open work in all active campaigns, counted by establishment;
   - individual (row selector) and bulk (ticked rows) assignment are unchanged.
4. **"Seguimiento" tab:**
   - one row per person: assigned, open, para hoy, overdue follow-ups, no activity for 3+ days, availability;
   - every number opens those tasks;
   - "Mover sus tareas abiertas": a permanent move, to one person or shared evenly;
   - new "Seguimiento" filter in "Tareas y asignación": open, due today, overdue follow-up, no activity for more than N days, covered for an absence.
5. **Absences:** "Usuarios" → "Ausencias": from, to, type (Vacaciones / Día libre / No disponible), optional note.
6. **Covering an absence:**
   - "Seguimiento" warns about absences today or in the next 14 days that have uncovered open tasks;
   - "Cubrir durante la ausencia": to one person, or shared evenly;
   - the tasks move on the first absent day and go back to their owner after the last one, if the campaign is still open;
   - deleting the absence returns them at once.

## Rules
- Calls stay credited to whoever made them.
- Absences are whole days.
- Covered tasks go back even if they were finished while covered.

## Decisions I made for you
- Covers start and end automatically when the app is opened (checked at most every 5 minutes). No scheduled job is needed.
- The absence warning looks 14 days ahead.
- "No activity" counts from the last call, or from the assignment if never called.

## Not included
- Email notifications, agents entering their own absences, and partial-day absences.

## Manual changes
- New sections "Resumen y leyenda", "Seguimiento del equipo" and "Ausencias".
- "Campañas" updated (script, workload, filters).
- A "Novedades" line.

## How to test it in the demo
1. `demo.admin` → campaign → "Seguimiento": a warning for Luis's vacation → "Cubrir durante la ausencia".
2. "Usuarios" → "Ausencias" on Ana → add one from today. In "Asignar tareas", she shows "Ausente" and is unticked.
3. "Configuración" → edit the script. Then sign in as `demo.agente1`, open a task and check the "Guion" panel.
4. Open the campaign's "Resumen" tab.
