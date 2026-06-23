# IndexedDB

IndexedDB no es la fuente principal de verdad. La aplicacion usa Dexie como respaldo local, migracion y almacenamiento temporal. Las tablas son:

- `settings`: configuracion unica `default`, zona horaria, cierre del dia y onboarding.
- `habits`: definicion heredada, borrado logico, archivo y orden.
- `habitSchedules`: programacion semanal con dias ISO `1` a `7`.
- `habitEntries`: un registro logico por `habitId + localDate`.
- `appBackups`: copias internas antes de importaciones, borrados y migraciones complejas.

Las fechas diarias se guardan como `YYYY-MM-DD`. Los timestamps se guardan como ISO UTC.

La sincronizacion remota vive en Firestore bajo `users/{uid}`. IndexedDB se usa para conservar copias locales, restauraciones y migraciones seguras desde sesiones antiguas.
