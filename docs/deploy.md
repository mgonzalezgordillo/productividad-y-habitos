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
