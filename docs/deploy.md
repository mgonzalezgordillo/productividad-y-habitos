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
