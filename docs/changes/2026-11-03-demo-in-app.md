# Demo inside the main app — 2026-11-03

**Goal:** You and trainees can open a demo with made-up data from the real app's address, protected by a password you choose. No Vercel and no special links.
**Who:** The Administrador turns the demo on, sets its password and resets it. Anyone with the demo password can enter.

Owner's answers: "1: The demo should be part of the main app, just an option I choose and put the password I choose for it. 2A, 3: a «reiniciar demo» button only. 4: should be visible but accessible through the password." Approved with "Go".

## How it works
1. **«Administración general → Demo»** (Administrador profile only):
   - «Demo activa» on/off;
   - «Contraseña de la demo»;
   - the link to share;
   - **«Reiniciar demo»**.
2. **Sign-in page:** when the demo is on, a visible **«Entrar a la demo»** link.
3. The link asks for the **demo password**, then shows one-click buttons:
   - «Entrar como Administrador»;
   - «… Supervisor»;
   - «… Agente de llamadas»;
   - «… Inspector»;
   - «… Gestor de quejas».
4. **Inside the demo:** a yellow bar «DEMO – datos ficticios» on every page, with «Salir de la demo». The demo Administrador also sees «Reiniciar demo» there.

## Rules
- **Separate database.** Nothing done in the demo reaches the real app, and the demo never sends anything to SIGTUR.
- **Demo and real sign-ins never mix.** A demo sign-in only counts inside the demo, and a real one only outside it.
- **The demo's settings can only be changed from the real app**, never from inside the demo.
- **The data resets only with «Reiniciar demo».**
- **Wrong passwords lock the entry.** After 5 wrong demo passwords in a row, the entry waits 15 minutes.
- **Saving the demo settings asks for your password** and is recorded in «Registro».
- The demo pass lasts 8 hours in that browser.

## Existing data
- The real app and its data don't change.
- The preview links for each change keep working as before.

## Decisions made
- The demo uses its **own database**. **One-time setup in Vercel:** two values, `TURSO_DEMO_DATABASE_URL` and `TURSO_DEMO_AUTH_TOKEN`, only for Production. It must be a new database, not the preview one, because previews reload theirs on every deploy.
- Every deploy brings the demo database up to date and fills it the first time.
- The demo password is stored encrypted.
- Signing in to the real app doesn't change.

## Not included
- Automatic nightly reset.
- A separate demo address.

## Manual changes
- «Primeros pasos»: how to enter the demo.
- «Administración»: the Demo tab.
- A new «Novedades» line.
