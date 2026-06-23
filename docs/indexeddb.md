# IndexedDB

IndexedDB es la fuente de verdad. La aplicacion usa Dexie con estas tablas:

- `settings`: configuracion unica `default`, zona horaria, cierre del dia y onboarding.
- `habits`: definicion de habitos, borrado logico, archivo y orden.
- `habitSchedules`: programacion semanal con dias ISO `1` a `7`.
- `habitEntries`: un registro logico por `habitId + localDate`.
- `appBackups`: copias internas antes de importaciones, borrados y migraciones complejas.

Las fechas diarias se guardan como `YYYY-MM-DD`. Los timestamps se guardan como ISO UTC.
