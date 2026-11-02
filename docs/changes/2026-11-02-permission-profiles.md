# Permission profiles («Perfiles de permisos») — 2026-11-02

**Goal:** Replace fixed roles and per-module levels with editable permission profiles. A profile is a checklist of actions. Each person has one profile.
**Who:** Administrators manage the profiles. Everyone works under one.

Owner's choices: "1A, 2A, 3A". Approved preview: https://claude.ai/artifact/Fu4fZ6zHifYzKGEazTGhKo ("Go").
- **1A:** editable profiles; one per person; the day-one profiles copy today's roles and levels.
- **2A:** no limit by campaign or zone for now.
- **3A:** only the Administrador profile manages profiles, in «Administración general → Permisos». Changes ask for the password and are logged.

## What changes

1. **«Administración general → Permisos»** has three views.

   **«Perfiles»**
   - On the left, the list of profiles: people per profile, actions per profile, and a «sin guardar» mark when there are unsaved changes.
   - The open profile shows its name, description and a checklist of 30 actions grouped by module (Llamadas 15, Quejas 11, General 4).
   - Ticking an action also ticks what it needs. Unticking removes what depends on it. A notice says what changed by itself.
   - «Lo que verá en el menú» and the people who have the profile are shown next to the checklist.
   - Buttons:
     - «Duplicar»;
     - «+ Nuevo perfil»;
     - «Eliminar», only when nobody has the profile;
     - «Guardar (afecta a N personas)», which asks for the password.
   - Leaving a profile with unsaved changes asks first.

   **«Personas y perfiles»**: one profile per person. Saving asks for the password.

   **«Comparar perfiles»**: a table of actions against profiles, with an Excel download.
2. **The Administrador profile** always has every action and can't be changed or deleted. There must always be at least one active person with it. «Permisos y perfiles» belongs to this profile only.
3. **Day one copies today exactly.**
   - Starting profiles:
     - Administrador;
     - Supervisor;
     - Agente de llamadas;
     - Agente · registra quejas;
     - Inspector;
     - Gestor de quejas.
   - Each person gets the profile that matches what they could do before.
   - Anyone whose old combination matches none of these gets an extra profile with exactly their old access, for example «Supervisor · sin quejas».
4. **Server checks everywhere.** Every screen, action and download now asks the profile. Anything not allowed answers «no encontrado». The menu, the campaign tabs and the «Administración general» tabs show only what the profile allows.
5. **New in complaints:**
   - **«Ver datos personales de quien presenta».** Without it, the presenter's name, ID, nationality, phone and email show as ••••, the presenter's name can't be searched, and case reports (which carry that data) can't be downloaded or generated. The person who registered a case always sees what they typed.
   - **«Descargar pruebas».**
   - People with «Trabajar los casos asignados» also see the cases assigned to them, even without «Ver todos los casos».
6. **«Personas»**
   - «Rol» becomes «Perfil».
   - Someone with «Personas» who isn't Administrador can only give profiles that don't exceed their own. They can't edit people who have more access.
   - «Ausencias» now belongs to the «Personas» action. It was administrators only, and that is still the case on day one.
7. **«Registro»** records profile created, changed (what was added or removed), deleted, and each person's profile change.

## Kept on purpose
- Nobody approves their own closing.
- Nobody changes their own profile.
- Sign-in doesn't change.
- No limits by campaign or zone (2A).

## Differences from the preview (to keep day one exactly as today)
- **Inspector profile:** the preview ticked «Hacer llamadas» and «Ver sus llamadas». Today inspectors only have «Visitas», so the starting profile has «Registrar visitas» only. Tick more if wanted.
- **Supervisor profile:** today supervisors can't create, edit, close or delete campaigns, or remove RUTs. The starting profile keeps that. Tick «Crear, editar, cerrar y eliminar campañas» and «Quitar RUT» to allow them.
- **«Trasladar tareas»** needs only «Ver campañas», not «Crear campañas», because supervisors do it today.
