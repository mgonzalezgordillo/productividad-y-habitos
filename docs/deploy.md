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

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS`

Configuralas en `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`.

El build de GitHub Pages ejecuta `npm run validate:oauth` antes de publicar. Si `NEXT_PUBLIC_GOOGLE_CLIENT_ID` falta, contiene un placeholder o no termina en `.apps.googleusercontent.com`, el despliegue falla para evitar enviar un `client_id` invalido a Google.

## Google Identity Services

Configuracion detectada:

- Flujo: popup con Google Identity Services e ID Token.
- Variable publica: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- URL de produccion: `https://mgonzalezgordillo.github.io/productividad-y-habitos/`.
- Origen de JavaScript de produccion: `https://mgonzalezgordillo.github.io`.
- Origen local: `http://localhost:3000`.
- Origen local alternativo: `http://127.0.0.1:3000`.
- Redirect URI: no aplica para este flujo.

En Google Cloud Console, el OAuth Client ID debe ser de tipo `Aplicacion web`. En `Orígenes de JavaScript autorizados`, añade solo los origenes, sin rutas:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://mgonzalezgordillo.github.io`

No añadas `client_secret` al frontend. Esta aplicacion no lo necesita.
