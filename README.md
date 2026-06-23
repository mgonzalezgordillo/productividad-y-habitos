# Habitos y Productividad

Aplicacion web responsive y PWA para registrar habitos con inicio de sesion con Google y sincronizacion por cuenta mediante Firebase.

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
- Firebase Authentication y Cloud Firestore para datos por cuenta.
- Dexie/IndexedDB para respaldo local, migracion y backups internos.
- Zustand para estado de interfaz.
- Zod y React Hook Form para formularios.
- `date-fns` y `date-fns-tz` para fechas locales y zonas horarias.
- Vitest, Testing Library y Playwright.
- Service worker propio mantenible.

## Configuracion publica

Define estas variables en el entorno local y en GitHub Actions:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS=persona1@gmail.com,persona2@gmail.com
```

## Autenticacion y acceso

La autenticacion usa Firebase Authentication con Google. Los datos se guardan bajo `users/{uid}` en Firestore. El correo solo se conserva como atributo de perfil.

Orígenes JavaScript autorizados:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://mgonzalezgordillo.github.io`

## Persistencia

Firestore es la fuente de verdad para cada cuenta autenticada. IndexedDB conserva respaldo local, migracion y copias temporales. La exportacion JSON permite trasladar datos entre dispositivos.

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
