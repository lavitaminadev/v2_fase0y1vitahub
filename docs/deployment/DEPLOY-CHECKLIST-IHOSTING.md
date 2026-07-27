# Checklist de despliegue en iHosting

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-27`
FUENTE DE VERDAD: `docs/deployment/ihosting.md`, `.cpanel.yml`, `app.js`

## Antes de subir

- working tree revisado y sin cambios accidentales en `.env`, `public_html` ni artefactos locales;
- `npm test -- --runInBand` en verde;
- confirmar que `apps/api/dist/`, `apps/web/dist/`, `tmp/` y `logs/` no se versionen;
- validar que el `.env` productivo del servidor siga alineado con `npm run check:production-env`;
- si hay migraciones nuevas, dejar claro si se ejecutan en esta ventana.

## En iHosting

1. Hacer `Update from Remote` en `Git Version Control`.
2. Ejecutar `Deploy HEAD Commit`.
3. Confirmar que `.cpanel.yml` termine sin errores.
4. Reiniciar Passenger si cPanel no lo hizo automaticamente.
5. Ejecutar `npm run migration:run` solo si el cambio incluye migraciones pendientes.

## Smoke test minimo

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.tudominio.cl/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://app.tudominio.cl
```

Esperado:

- API `200` si todo esta sano o `503` si una dependencia critica quedo caida;
- frontend `200`;
- login administrador operando;
- dashboard, widget y `Ctrl+K` sin mostrar acciones fuera de permisos;
- notificaciones de sistema visibles solo para administracion;
- una reserva de prueba abre, guarda y vuelve a listar correctamente.

## Si algo falla

- revisar logs de Passenger y la salida de `.cpanel.yml`;
- verificar `apps/api/dist/main.js`, `apps/web/dist/index.html` y `apps/web/dist/.htaccess`;
- confirmar `APP_PUBLIC_URL`, `API_PUBLIC_URL`, `VITE_API_URL` y `CORS_ORIGIN`;
- si hubo migracion, comprobar version aplicada antes de reintentar.

## Rollback seguro

- volver a desplegar desde el ultimo commit estable conocido en cPanel o desde Git;
- revertir migraciones solo si el cambio las incluyo y se evaluo su impacto;
- evitar `git reset --hard` sobre el servidor como procedimiento por defecto.
