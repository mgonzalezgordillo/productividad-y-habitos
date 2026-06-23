# Exportacion e importacion

La exportacion JSON incluye version de esquema, fecha de exportacion, configuracion, habitos, programaciones y registros.

La exportacion CSV incluye fecha, habito, tipo, estado, valor, unidad, objetivo y nota.

La importacion valida con Zod:

- Version de esquema.
- Fechas `YYYY-MM-DD`.
- Timestamps ISO UTC.
- Estados reconocidos.
- Relacion entre habitos, programaciones y registros.
- Unicidad logica `habitId + localDate`.
- Tamano maximo del archivo.

Antes de fusionar o reemplazar se crea un respaldo automatico. La sustitucion requiere confirmacion explicita.

Durante la importacion, los registros se reasignan al UID autenticado actual. Ningun backup importado puede sobrescribir la identidad de otra cuenta.
