# Arquitectura Actual - VITAHUB

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-17`

## Stack

- Node `20.20.2`
- Backend NestJS + TypeORM + MySQL
- Frontend React + Vite
- Despliegue productivo: cPanel + Git Version Control + Phusion Passenger

## Estructura Relevante para Produccion

```text
/
|-- app.js
|-- .cpanel.yml
|-- package.json
|-- apps/api/
|   `-- dist/main.js
|-- apps/web/
|   `-- dist/
`-- packages/shared/
    `-- dist/
```

## Flujo Oficial de Despliegue

1. cPanel gestiona el repositorio Git.
2. `Update from Remote` trae cambios desde GitHub.
3. `Deploy HEAD Commit` ejecuta `.cpanel.yml`.
4. `.cpanel.yml` corre `npm ci`, compila `shared`, `api` y `web`.
5. `.cpanel.yml` copia `apps/web/dist/` a `public_html`.
6. `app.js` arranca `apps/api/dist/main.js`.
7. Passenger reinicia la API.
8. Las migraciones quedan como paso manual.

## Convivencia API + Frontend

- API: corre por Passenger desde la raiz del repo.
- Frontend: se sirve estatico desde `public_html`.
- `app.js` no sirve frontend; solo backend.
- El backend necesita haberse compilado antes del restart.
