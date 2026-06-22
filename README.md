# Habitos Local First

Aplicacion web responsive y PWA para registrar habitos sin cuenta y sin backend obligatorio. IndexedDB es la fuente de verdad.

## Comandos

```bash
npm install
npm run dev
npm run test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

## Docker

```bash
docker compose up --build
```

La imagen sirve el export estatico de Next.js en `http://localhost:8080`.

## Arquitectura

- Next.js App Router, React y TypeScript strict.
- Tailwind CSS con la paleta `turquoise-blue`.
- Radix UI para dialogos, labels y tooltips.
- Dexie/IndexedDB para persistencia local.
- Zustand para estado de interfaz.
- Zod y React Hook Form para formularios.
- `date-fns` y `date-fns-tz` para fechas locales y zonas horarias.
- Vitest, Testing Library y Playwright.
- Service worker propio mantenible.

## Persistencia

Los datos pertenecen al navegador y perfil desde el que se usa la aplicacion. Los habitos, programaciones y registros no se envian a servicios externos. Para conservarlos o trasladarlos hay que exportar una copia JSON.

## Cierre diario

Al iniciar, al recuperar la ventana y mediante temporizador mientras la aplicacion esta abierta, se revisan fechas vencidas segun la zona horaria y la hora de cierre configuradas. El proceso es idempotente.

Si la aplicación permanece cerrada, los hábitos pendientes se marcarán como incompletos la próxima vez que se abra.

## Documentacion

- [IndexedDB](docs/indexeddb.md)
- [Migraciones](docs/migrations.md)
- [Exportacion e importacion](docs/import-export.md)
- [Despliegue](docs/deploy.md)
- [Privacidad](docs/privacy.md)
- [Limitaciones conocidas](docs/known-limitations.md)
