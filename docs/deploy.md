# Despliegue

La aplicacion usa `output: "export"` en Next.js.

## Vercel

Ejecuta `npm run build` y publica `out`.

## Netlify

Build command: `npm run build`. Publish directory: `out`.

## Cloudflare Pages

Build command: `npm run build`. Output directory: `out`.

## GitHub Pages

Publica el contenido de `out`. Si se usa un subdirectorio, configura `basePath` y `assetPrefix` en `next.config.ts`.

El workflow incluido usa GitHub Actions y lee estas variables del repositorio:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS`

Configuralas en `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`.

El build de GitHub Pages ejecuta `npm run validate:firebase-config` antes de publicar. Si falta alguna variable publica o contiene un placeholder, el despliegue falla.

## Firebase

Configuracion detectada:

- Autenticacion: Firebase Authentication con Google.
- Base de datos: Cloud Firestore.
- Identidad principal: `uid`.
- Correo: atributo de perfil.
- URL de produccion: `https://mgonzalezgordillo.github.io/productividad-y-habitos/`.
- Origen de JavaScript de produccion: `https://mgonzalezgordillo.github.io`.
- Origen local: `http://localhost:3000`.
- Origen local alternativo: `http://127.0.0.1:3000`.

En Firebase Console, añade los dominios autorizados y publica las reglas de Firestore incluidas en `firestore.rules`.

No añadas `client_secret` al frontend.
