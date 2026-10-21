# Faster app — 2026-10-21

**Goal:** clicks respond instantly and screens appear sooner.
**Who:** everyone (Administrador, Supervisor, Agente, Inspector). Nothing changes in what people can see or do.

## How it works
1. **Instant response on every click:** a thin yellow bar appears at the top the moment a link is clicked, until the next screen is shown. The statistics screens show their outline with grey placeholders while the numbers arrive.
2. **Fewer waits per screen:** each screen asks the database for everything at the same time, and reads the person's account only once. This applies to "Mis llamadas", the call task, the dashboards, the global statistics and the menu counter.
3. **Saving a call:** fewer checks one after another, a single screen refresh instead of two, and the activity log is written right after the answer is sent.
4. **Faster lookups:** search shortcuts (indexes) for assigned agents, phones, results, visits and status changes, so large campaigns stay quick.
5. **Location (administrators):** "Registro" shows where the database and the app's servers are, plus how long one database answer takes, and whether they are close.

## Rules
- No rule changes. Every permission check still happens on the server before anything is shown.

## Approval flow / Notifications
None.

## Existing data
Unchanged. The new indexes are added automatically on the next deployment.

## Decisions I made for you
- Grey placeholders are used only on screens without forms (statistics). On screens with forms they would lose the "saved" message, so those show the top bar instead.
- The location panel shows only the region name, never the database address.

## Measured locally (simulating a database 40 ms away)
| Screen | Before | After |
|---|---|---|
| Mis llamadas | ~265 ms | ~190 ms |
| Call task | ~225 ms | ~185 ms |
| Saving a call (until the screen is updated) | ~700 ms | ~430 ms |

## Not included
- Moving the database or the servers (done only if the location panel shows they are far apart).
- Changing screens or rules.

## Manual changes
- "Novedades" line; "Administración" mentions "Ubicación y velocidad".

## How to test it in the demo
1. Click between menu items: the yellow bar appears at once.
2. Open "Estadísticas globales": the outline appears immediately, then the numbers.
3. Save a call as `demo.agente1`: "Llamada registrada" appears sooner.
4. `demo.admin` → "Registro": the "Ubicación y velocidad" panel at the top.
