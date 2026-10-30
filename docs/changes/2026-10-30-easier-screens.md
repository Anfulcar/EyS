# Design improvements: menu, multi-choice filters, bar, windows, phone, help — 2026-10-30

**Goal:** Make daily work easier without changing what the app does.
**Who:** Everyone sees it. The filters and the action bar are mostly used by Administrador and Supervisor.

## How it works
1. **Collapsible side menu.** The menu stays visible while you scroll. «Plegar menú» folds it to icons only, and the app remembers your choice on that computer.
2. **Multi-choice filters.** Every filter that offered one option lets you tick several. Each choice shows as a label you can remove with ×, and «Quitar todos» clears every filter. This covers:
   - «Tareas y asignación»;
   - «Mis llamadas» (campaigns);
   - «Revisión»;
   - «Visitas»;
   - «Registro»;
   - the call list in «Resumen del agente».
3. **Action bar for ticked rows.** In «Tareas y asignación», the bar appears at the bottom only when rows are ticked. It shows: «N marcadas · Asignar seleccionadas a ▾ · Aplicar · Eliminar… (administrators) · ×».
4. **The app's own confirmation windows and notices.** The grey browser boxes become windows in the app's style. «Guardado» and other success messages appear as a green notice at the top right that disappears by itself.
5. **Phone.** The top menu becomes a ☰ button that opens a side panel. On the call form, a field that gets focus scrolls above the «Guardar» bar.
6. **Quick help and «↑ Arriba».**
   - A «?» next to indicator titles in «Estadísticas», «Tablero» and «Resumen del agente».
   - A floating «↑ Arriba» button on long pages.

## Rules
- Within one filter, a row shows if it matches **any** of the ticked options. Between different filters, it must match **all** of them.
- «Eliminar de la campaña → todas las filtradas» uses exactly the same filters as the list. The server checks the role as before.

## Approval flow
None.

## Notifications
None new. Error messages stay next to the form. Messages that must be read or copied also stay in the form:
- a new password;
- a new SIGTUR key;
- the summary of an upload.

## Existing data
Nothing changes. Old links and the «Seguimiento» shortcuts still open the same filtered lists.

## Decisions I made for you
- The menu's folded or open state is remembered per computer; there is no extra setting.
- Each filter keeps the same place and the same label it has today.
- A confirmation that already asks you to type ELIMINAR still asks for it.
- In «Mis llamadas», the «Agente» choice for managers stays single: it picks whose call list you are looking at. It is not a filter.
- «↑ Arriba» is not shown on the call screen, so nothing covers the «Guardar» button.
- Several choices travel in the page address, so a filtered list can still be bookmarked or shared.

## Not included
- The desktop call screen (it doesn't change).
- Shorter campaign tabs with «Más ▾» (idea 2).
- The «Acciones ▾» menu and fold-away filter panel (idea 3).
- Fold-away sections in Integraciones / Configuración / Usuarios (idea 6).
- New filters in «Estadísticas».

## Manual changes
- «Primeros pasos»: menu, phone, multi-choice filters, notices and confirmations, «?» and «↑ Arriba».
- «Campañas: carga y asignación»: the bar for ticked rows, filters with several choices.
- "What's new" line dated 2026-10-30.

## How to test it in the demo
1. Sign in as `demo.admin` and press «Plegar menú». Scroll down a long page: the menu stays visible.
2. In «Tareas y asignación», tick «Sin llamar» and «Reintentar» in «Estado» and two zones, then press «Filtrar». The list shows only those tasks, with labels you can remove with ×.
3. Tick 3 rows: the bar appears at the bottom. Assign them; a green notice confirms it.
4. In «Informes», delete a report: the app's own window asks you to confirm.
5. On a phone, sign in as `demo.agente1`. Open ☰, then open a task: «Guardar» doesn't cover the field you are filling in.
6. In «Estadísticas», tap «?» next to «Contacto efectivo». In «Mis llamadas», scroll down and press «↑ Arriba».
