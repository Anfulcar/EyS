# «Quejas y reclamaciones» module — 2026-11-02

**Goal:** One file per complaint, claim, report or suggestion, from reception to closing, with proof, referrals and a report. It is kept separate from the call campaigns.
**Who:** Per person, set in «Permisos por módulo»:
- **Registrar:** creates cases and sees their own.
- **Gestionar:** sees every case and works the ones assigned to them.
- **Supervisar:** everything, plus assigning, approving closings, reopening and the module settings.

Administrators can do everything.

Owner's answers (from the preview iterations):
- 1A: four levels per person.
- 2A: closing proposed by the handler and approved by a supervisor, never the same person.
- 3: deadlines editable in the module's settings.
- 4: no emails for now; reports only. «Consultar mi caso» waits for the SIGTUR connection.

## How it works
1. **Cases come in from three places:**
   - the public form `/formulario-quejas` (no account);
   - SIGTUR (`POST /api/integrations/sigtur/complaints` with the connection key);
   - registered in the app («+ Nuevo caso»).
2. **Every case starts with who it is about:**
   - a RUT or SIGTUR ID, whose details come from the SIGTUR data loaded in the campaigns;
   - or typed details if it isn't in SIGTUR.

   Then: who brings it (or anonymous), type, topic, channel, priority, subject, description and proof.
3. **The case file:**
   - **Resumen**;
   - **Pasos dados**: visible or internal, never deleted;
   - **Referencias**: institution, expected answer date, answer received;
   - **Pruebas**: files up to 8 MB, never deleted, marked «reemplazada» instead;
   - **Solución y cierre**;
   - **Informes**.
4. **Deadlines per type, in business days:**
   - first attention (assign the case and record a first step) and answer (close the case);
   - a coloured dot in the list: green, amber within the warning days, red when overdue.
5. **Closing:**
   - the handler proposes it with the solution;
   - a supervisor approves it or returns it with a reason;
   - the PDF report is generated automatically on approval;
   - «Generar informe» makes new versions, and earlier ones are kept;
   - a supervisor can reopen a closed case.
6. **«Estadísticas»:** received, % answered on time, average business days to close, open cases out of time, per week, topic, channel, type, establishment and handler.
7. **«Configuración»:** deadlines per type, warning days, topics, institutions, and the public form on/off with its address.

## Rules
- Each case gets a number per year: QR-2026-0001.
- Permissions are checked on the server for every screen, action and download:
  - a case a person may not see answers «no encontrado»;
  - files and reports are only served to people who may see the case.
- Personal data of the person who brings the case is only visible to people at «Gestionar» or above, and to whoever registered the case.
- Internal notes never appear in the report.
- **Public form protection:**
  - a hidden field that robots fill in;
  - a minimum time to fill the form;
  - at most 5 cases per connection per hour;
  - consent to use the personal data is required.
- Proof is uploaded in 2 MB pieces, so phone photos up to 8 MB work. On the public form the files are tied to the case just created, through a 30-minute permission.

## Approval flow
The closing is proposed by the handler and approved by a supervisor. Nobody approves their own closing.

## Notifications
None (no emails for now).

## Existing data
None to move. The call campaigns don't change.

## Decisions I made for you
- Files are stored in the app's own database, so no new service or key is needed.
- The SIGTUR address uses the same access key as the other SIGTUR addresses.
- People without call campaigns but with a complaints level start on «Quejas y reclamaciones».
- A new demo person, `demo.quejas`, handles complaints only. `demo.supervisor` supervises and `demo.agente1` registers. The demo has four example cases.

## Not included
- «Consultar mi caso» for the public and emails to the person (they come with the SIGTUR connection).
- The historical upload (next step, with its Excel template, which we build together).

## Manual changes
- New section «Quejas y reclamaciones».
- "What's new" line dated 2026-11-02.
- `docs/sigtur-integracion.md` section 5.

## How to test it in the demo
1. As `demo.admin`: «Quejas y reclamaciones» → «+ Nuevo caso». Search a demo RUT, fill in the case, attach a photo and assign it to Laura Quejas.
2. As `demo.quejas`: open the case, add a step, refer it, and propose the closing.
3. As `demo.supervisor`: approve the closing and download the report from «Informes».
4. Open `/formulario-quejas` in a private window and send a case. It appears in «Casos» with the channel «Formulario web».
5. Look at «Estadísticas» and «Configuración».
