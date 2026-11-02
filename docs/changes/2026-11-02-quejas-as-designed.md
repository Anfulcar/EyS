# «Quejas y reclamaciones» exactly as the approved preview — 2026-11-02

**Goal:** The built module had moved away from the approved preview. This change brings it back to the preview's layout and division, and to the roles shown there.
**Who:** Everyone who uses the module. Administrators, for the new role.

Owner's request: "I want the same layout and division from the calls module. They have to be exactly as we designed. All roles as you have them on the preview as well."

## What changes to match the preview
1. **The menu is divided by module**, with a heading per group:
   - **Campañas de llamadas**: its screens, including «Configuración · Llamadas»;
   - **Quejas y reclamaciones**: «Casos» (with a pending count), «Formulario público», «Estadísticas», «Configuración del módulo»;
   - **General**: «Administración general», «Ayuda».

   The tabs inside the module's pages are removed, because the menu now does that job.
2. **New role «Gestor de quejas»**, as in the preview's people list. It works only in the complaints module, with no call campaigns and at least «Gestionar».
3. **«Casos»:**
   - five counters: Abiertos, Fuera de plazo, Sin asignar, Cierres por aprobar, Asignados a mí;
   - one row of filters: search, Estado, Tipo, Canal;
   - the preview's columns (Caso, Asunto, Involucrado, Tipo, Canal, Estado, Plazo de respuesta, Responsable), with the whole row clickable;
   - channels coloured as in the preview.
4. **«Nuevo caso»** opens in a centred window, with a dashed box for choosing files and «Cancelar» / «Crear caso».
5. **The case file:**
   - the status and the handler save as soon as they are chosen;
   - the summary shows «Otros casos de este RUT» and «En campañas de llamadas: N tarea(s) abierta(s)»;
   - «Informes» has «Generar informe ahora».
6. **«Estadísticas»:** bars as in the preview (name, bar and number on one line), and the «Excel» button.
7. **«Configuración del módulo»:**
   - the deadlines table with «Avisar cuando falten … días hábiles» and «Guardar plazos»;
   - topics and institutions one per box, with «+ Agregar tema» / «+ Agregar institución».
8. **«Formulario público»:** the «Conozco su RUT / registro» | «No lo conozco» switch, the dashed file box and «No soy un robot».
9. **«Permisos por módulo»:** the «Administrador» column, as in the preview.

## Kept on purpose (decided after the preview)
- «Permisos por persona» stays in «Administración general → Permisos por módulo» (approved 2026-11-02).
- No emails, and no «Consultar mi caso» page (approved).
- The filters accept several choices (the owner's rule for every filter).
- The preview's «Viendo como» selector and «Simular caso desde SIGTUR» were only for trying the preview. SIGTUR cases arrive through the real connection.

## Existing data
Nothing changes. The demo has two «Gestor de quejas» people: Laura Quejas and José Quejas.

## Manual changes
- The «Quejas y reclamaciones» section describes the menu group and the new role.
- "What's new" line dated 2026-11-02.

## How to test it in the demo
1. As `demo.supervisor`, the menu shows the three groups. «Casos» opens the list with the five counters.
2. Use «+ Nuevo caso» (a centred window), then open a case and change its status from the list at the top.
3. In «Configuración del módulo», add a topic with «+ Agregar tema» and press «Guardar».
4. Sign in as `demo.quejas` (Gestor de quejas): only the «Quejas y reclamaciones» group and «General» appear.
