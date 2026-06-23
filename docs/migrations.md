# Migraciones

El esquema local se versiona con `Dexie.version()`. La version inicial es `1`.

Antes de una migracion compleja debe ejecutarse una copia interna en `appBackups` con el motivo de migracion. Las migraciones deben ser idempotentes y no deben enviar datos a servicios externos.

Cuando un usuario autenticado con Google inicia sesion y existen datos antiguos en IndexedDB, la aplicacion puede pedir confirmacion para asociarlos a su UID y subirlos a Firestore. La asociacion no elimina el respaldo local hasta que la subida se verifica.
