# Email: correct it, "didn't receive it", change report, email campaigns — 2026-10-30

**Goal:** Find the establishments that didn't receive the email, correct their address, and send it again: by email, by phone, or both. Keep a list of every data change so it can be updated in SIGTUR by hand.
**Who:** Agents and inspectors record it. Administrators and supervisors create the campaigns and download the report.

Owner's answers: 1A, 2A plus a «Reporte de cambios» with history, 3A, 4 = one button per action.

## How it works
1. **In the call (agents)**
   - When the agent spoke with someone, the «Correo» box shows the **current** email, already filled in, and can be corrected.
   - Next to it is a new question: **«¿Recibió el correo? Sí / No»**.
   - The call result (01–10) and what happens to the task don't change.
   - The call screen keeps its layout: the question sits in the same «Persona» block as the email.
2. **In the visit (inspectors):** «Actualizar datos» has a **«Nuevo correo»** box.
3. **«Tareas y asignación»**
   - New filter **«¿Recibió el correo?»**: Sí / No / Sin dato. It accepts several choices.
   - Two separate buttons work on the filtered list:
     - **«Nueva campaña de llamadas con estas tareas»**: the existing button, with the new filter added. The original tasks close as «Transferida».
     - **«Nueva campaña de correo con estas tareas»** (new): creates a «Campaña de correo». **The original tasks keep going.**
4. **«Campaña de correo»**
   - It has no calls and no agents, and doesn't appear in «Mis llamadas», «Visitas», statistics or SIGTUR call requests.
   - Its tabs are «Correos», «Tareas», «Exportar» and «Configuración».
   - In «Correos» you can download the mail-merge list with the **corrected** email, mark as sent, load bounces, and see the counts of sent, bounced and corrected emails.
5. **«Reporte de cambios»** (in «Informes»)
   - Every data change: email, name, address, owner, «¿En operación?», closed since.
   - Each change shows the RUT, ID SIGTUR, establishment, campaign, field, old value → new value, who changed it, when, and whether it came from a call or a visit.
   - Filters (several choices): campaign, field, dates, search, and state «Pendiente / Actualizado en SIGTUR».
   - **Excel download.** You tick the rows and press **«Marcar como actualizado en SIGTUR»**; the report records who marked them and when.

## Rules
- The corrected email replaces the old one everywhere from then on: mail merge, the bounce check, exports and the call screen. The original email is kept in the report.
- The bounce mark is cleared when the email is corrected.
- An email campaign copies the chosen establishments with their current data. Sent and bounce marks start empty, because it is a new mailing.
- The Excel exports have a new «¿Recibió el correo?» column, in the establishments sheet and the calls sheet.

## Approval flow
None.

## Notifications
None.

## Existing data
- Past calls don't have an answer to «¿Recibió el correo?» and show as «Sin dato».
- **The change report starts with the history:**
  - every change sent to the SIGTUR queue since 26 Oct, with its exact date;
  - emails corrected before that, dated with the establishment's last call with contact and marked «fecha aproximada».
  
  Everything starts as «Pendiente en SIGTUR».

## Decisions I made for you
- «¿Recibió el correo?» is not required, so it doesn't slow down calls.
- «Marcar como actualizado en SIGTUR» can be done by administrators and supervisors. The server checks the role, and a row already marked keeps its first mark.
- Email campaigns don't count in the call statistics or reports.
- When the automatic sending to SIGTUR is switched on, it keeps working as before. The report is a separate record.

## Not included
- The app doesn't send emails itself: you keep using mail merge.
- Editing the email outside a call or a visit.
- One button that creates both campaigns at once (one button per action, as asked).

## Manual changes
- «Registrar una llamada», «Actualizar datos del establecimiento» (new email field and the change report), «Campañas» («Correos») and «Nueva campaña con resultados de otra» (both buttons and the email campaign).
- "What's new" line dated 2026-10-30.

## How to test it in the demo
1. As `demo.agente1`, open a task and answer «Sí» to «¿Pudo contactar a alguien?». The email appears filled in. Correct it, answer «¿Recibió el correo?» with No, and save.
2. As `demo.admin`, in «Tareas y asignación», filter «¿Recibió el correo?: No». The demo already has two such tasks.
3. Press «Nueva campaña de correo con estas tareas», fill in the end date and create it. It opens on «Correos», and the mail-merge list has the corrected email. The original tasks are still open.
4. Press «Nueva campaña de llamadas con estas tareas» on the same filter. It works as before.
5. In «Informes» → «Reporte de cambios», the email change appears as «Pendiente en SIGTUR». Download the Excel, tick the row and press «Marcar como actualizado en SIGTUR».
