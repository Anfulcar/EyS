# One settings panel per module, a general one, and permissions per module — 2026-11-02

**Goal:** Prepare the app for a second module («Quejas y reclamaciones») by putting each setting where it belongs, and decide per person who uses each module.
**Who:** Administrators (general panel, permissions); administrators and supervisors (calls settings).

Owner's answers: one panel per module plus a general one; 1A (module settings: administrators and whoever supervises the module); 2A (SIGTUR keys and sending in the general panel).

## How it works
1. **«Administración general»** (menu, administrators only). Its tabs are:
   - **Personas**: the old «Usuarios», with absences.
   - **Permisos por módulo**: new.
   - **Conexión con SIGTUR**: access keys, automatic sending of results, the connection log.
   - **Registro**.
2. **«Configuración · Llamadas»** (menu, administrators and supervisors):
   - **Values for new campaigns**: maximum attempts, follow-up days, and the standard call script, which is copied to each new campaign.
   - **SIGTUR call requests**: switch on or pause, who receives them, and simulate a request. These moved from «Integraciones».
3. **«Permisos por módulo»**:
   - For each person: access to the call campaigns (yes/no), and their level in «Quejas y reclamaciones» (Sin acceso / Registrar / Gestionar / Supervisar). The level is used when that module arrives.
   - Administrators always have access to everything.

## Rules
- Without access to the call campaigns, every call screen, action and download answers «no encontrado». The check is on the server. The person starts on «Ayuda».
- Supervisors can now switch SIGTUR call requests on or off, and choose who receives them (1A).
- Saving permissions asks to confirm the password if it has been a while since signing in, the same as other sensitive actions. Each change is written to «Registro».
- The new-campaign values apply only to new campaigns. Existing campaigns keep theirs.

## Approval flow
None.

## Notifications
None.

## Existing data
Everyone keeps access to the call campaigns. Everyone starts at «Sin acceso» for complaints. The addresses of the old pages still work.

## Decisions I made for you
- The pages keep their addresses (`/users`, `/integrations`, `/logs`) and are grouped under one menu entry with tabs, so nothing that already works breaks.
- The automatic sending to SIGTUR stays in the general panel, because both modules will use it.

## Not included
- The «Quejas y reclamaciones» module itself (next pull request), and its own settings panel.

## Manual changes
- «Administración» section, the SIGTUR sections and absences point to the new places.
- "What's new" line dated 2026-11-02.

## How to test it in the demo
1. As `demo.admin`, open «Administración general» and go through the four tabs.
2. In «Permisos por módulo», untick «Campañas de llamadas» for an agent and save. Sign in as that agent: they land on «Ayuda», and «Mis llamadas» answers «no encontrado».
3. In «Configuración · Llamadas», set «Intentos máximos» to 4 and save. «+ Nueva campaña» now starts with 4.
4. As `demo.supervisor`, open «Configuración · Llamadas»: you can switch the SIGTUR requests on or off.
