# Migraciones

El esquema local se versiona con `Dexie.version()`. La version inicial es `1`.

Antes de una migracion compleja debe ejecutarse una copia interna en `appBackups` con el motivo de migracion. Las migraciones deben ser idempotentes y no deben enviar datos a servicios externos.
