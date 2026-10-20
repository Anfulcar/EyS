# Cleaner administration screens — 2026-10-20

**Goal:** The administration screens feel clean and easy to use instead of clumsy.
**Who:** Administrador and Supervisor use these screens; agents and inspectors are not affected.

## How it works
1. **Campañas:** campaign cards only; a **"+ Nueva campaña"** button opens the form in a pop-up window.
   The cards show the right numbers of tasks and establishments (they showed 1).
2. **Tareas y asignación:** the list comes first, compact, one line per establishment, with the last result
   as a short coloured label ("Compromiso", "No contesta", "Se niega"…). An **"Asignar tareas"** button opens a
   side panel with the assignment methods. Rows can be ticked and assigned together ("Asignar seleccionadas a…").
   Changing the agent in a row saves on its own.
3. **Usuarios:** a **"+ Nuevo usuario"** button opens a pop-up; **Editar** opens the same pop-up for that person.
4. **Configuración:** campaign details, then a clear "Estado de la campaña" box, then a separate "Zona de peligro"
   box for deleting.
5. **File uploads** (Carga masiva, Correos, Estatus) use the same friendly "Seleccionar archivo" button.
6. **Filters** (tasks, Registro) sit on one tidy line.
7. **Menu:** "Mis llamadas" shows for administrators and supervisors only when they have calls assigned.

## Rules
- No rule changes. Assigning ticked rows follows the same permissions (Administrador, Supervisor) and is
  recorded in Registro.

## Approval flow
None.

## Notifications
None.

## Existing data
Untouched.

## Decisions I made for you
- Pop-ups close with the ✕ button or by clicking outside; the user's starting password stays visible in the
  pop-up after creating them so it can be passed on.
- Result labels in the task list are short versions of the full results; the full text shows when hovering.
- The "Fecha" (created on) column in Usuarios is removed; the date is still in Registro.

## Not included
- Agent and inspector screens (redesigned earlier).
- Dashboards and statistics content (only spacing benefits).

## Manual changes
- "Campañas: carga y asignación" and "Administración" sections updated; "What's new" line added.

## How to test it in the demo
1. Sign in as `demo.admin` → **Campañas**: the card shows 36 tasks; "+ Nueva campaña" opens a pop-up.
2. Open the campaign → **Tareas y asignación**: compact list; tick two rows → "Asignar seleccionadas a" Luis → Aplicar.
3. Click **Asignar tareas** → side panel with the methods.
4. **Usuarios** → "+ Nuevo usuario" and **Editar** open pop-ups.
5. **Configuración**: status box and "Zona de peligro" are separate.
6. As `demo.supervisor`, "Mis llamadas" is not in the menu (no calls assigned).
