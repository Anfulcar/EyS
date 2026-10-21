# Servidores junto a la base de datos — 2026-10-21

**Objetivo:** que la aplicación responda más rápido.
**Quién:** todos; nada cambia en lo que se ve o se hace.

## Antes / ahora
- «Registro» → «Ubicación y velocidad» mostraba: base de datos en EE. UU. Este (Ohio), servidores en Washington D. C., 26 ms por respuesta de la base de datos («Están lejos»).
- Ahora los servidores de la aplicación funcionan en Cleveland (Ohio), junto a la base de datos. Se espera alrededor de 1–3 ms por respuesta.

## Datos existentes
Sin cambios: la base de datos y sus datos siguen donde están.

## Decisiones que tomé
- Región de Vercel «cle1» (Cleveland), la más cercana a la base de datos en Ohio.

## Cómo comprobarlo
Después de publicar: «Registro» → «Ubicación y velocidad» debe decir «Servidores de la aplicación: EE. UU. Este (Cleveland)» y «Están cerca», con pocos milisegundos.
