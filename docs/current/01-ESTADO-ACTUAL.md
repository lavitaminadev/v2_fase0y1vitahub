# Estado Actual

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-18`
FUENTE VERIFICADA: codigo y working tree local posterior al commit base
FUENTE: codigo real del repo local + ejecucion de comandos reales

## Resumen Ejecutivo

Estado final de la revision del `2026-07-18`:

- `npm run build:cpanel`: PASS
- `npm run lint --workspace @vitahub/api`: PASS
- `npm run lint --workspace @vitahub/web`: PASS
- `npm run test:api`: PASS (`42` archivos, `155` tests)
- `npm audit --audit-level=high`: PASS (`0` vulnerabilidades)
- auditoria estatica frontend: `164` botones en `58` vistas/componentes TSX, ninguno sin accion y ningun submit accidental;
- verificacion visual real: login en escritorio y movil, sin overflow y con controles tactiles de `44px`;
- artefacto cPanel: `.htaccess` presente con redireccion HTTPS, HSTS y fallback SPA.

La fase de estabilizacion ya no esta en estado teorico. El sistema quedo compilando y con pruebas backend en verde para el alcance auditado:

- `npm run build:api`: PASS
- `npm run build:web`: PASS
- `npm run lint:api`: PASS
- `npm run lint:web`: PASS
- `npm run test:api`: PASS (`42` archivos, `155` tests)

## Validacion Local Integrada

El entorno Windows local quedo preparado sin Docker con MariaDB `11.4.12` portatil, API y frontend:

- reconstruccion completa desde una base vacia: PASS (`19` migraciones);
- seed demostrativo repetible y con aborto inmediato ante errores SQL: PASS;
- salud de API, conexion a base de datos y escritura de archivos: PASS;
- login de administrador y cliente, dashboard, CRM, produccion, operaciones y reservas: PASS;
- constructor de reservas en cuatro pasos y portal cliente con aislamiento de roles: PASS;
- reserva publica real desde disponibilidad hasta codigo de confirmacion: PASS;
- consola del navegador en los flujos verificados: sin errores;
- embudo demo normalizado: `4` visitas, `3` inicios, `2` reservas y `50%` de conversion.

Comandos operativos: `npm.cmd run local:start`, `local:status`, `local:seed` y `local:stop`.

## Correcciones Confirmadas

- Se corrigieron fallas de compilacion en API y Web.
- Se alineo la UI CRM con el backend agregando `GET /crm/leads/:id`.
- Se corrigio el handler de conversion Meta para usar el modelo real de cuentas `PAGE` y `pixelId` persistido en integracion.
- Se endurecio el flujo manual de sincronizacion Meta para respetar aislamiento por organizacion.
- Se bloqueo el procesamiento de leads Meta para paginas no seleccionadas operativamente.

## Estado Real de CRM

- Existe modulo CRM operativo con leads, contactos, oportunidades e interacciones.
- El flujo minimo verificado hoy es: listar leads, abrir detalle, crear/actualizar lead por intake, convertir lead.
- La entidad `Lead` conserva trazabilidad de fuente, campaña, formulario, pagina, scoring y conversion.
- El detalle de lead ahora tiene endpoint real y ya no depende de un contrato inexistente.

## Estado Real de Meta

- Existe flujo OAuth iniciado desde frontend y servido por backend.
- El backend firma y verifica `state` con HMAC y expiracion de 10 minutos.
- Se almacenan tokens cifrados (`enc:v1:`) en la configuracion de integracion.
- Se descubren paginas, perfiles de Instagram y cuentas publicitarias desde Graph API.
- La seleccion de activos se persiste y se usa para determinar `leadCaptureReady`.
- Existe webhook publico para Meta, descarga de lead detail y alta/actualizacion de lead CRM.
- Existe validacion de pixel y envio de evento de prueba a CAPI.

## Segunda Pasada Global

En una pasada adicional sobre el resto del proyecto se detectaron y corrigieron problemas transversales fuera del nucleo CRM/Meta:

- Se corrigio el modulo de reportes para consultar la tabla real `invoices`.
- Se dejo de mostrar en Direccion metas y KPIs inventados como si fueran reales.
- Se alineo el portal cliente con la respuesta real de `GET /reporting/reports`.
- Se agregaron pruebas del controlador de reportes.

Estado validado luego de esta segunda pasada:

- `npm run build:api`: PASS
- `npm run build:web`: PASS
- `npm run lint:api`: PASS
- `npm run lint:web`: PASS
- `npm run test:api`: PASS (`25` archivos, `102` tests)

## Tercera Pasada Global

En una iteracion posterior enfocada en seguridad de acceso y aislamiento multiempresa se corrigio:

- acceso indebido de usuarios `client` a dashboards internos, operaciones y KPIs de direccion;
- exposicion de todas las organizaciones a cualquier usuario autenticado;
- exposicion de otros clientes de la misma organizacion a usuarios portal;
- actualizacion/eliminacion de items de contenido sin verificacion de tenant.

Estado validado luego de esta tercera pasada:

- `npm run build:api`: PASS
- `npm run build:web`: PASS
- `npm run lint:api`: PASS
- `npm run lint:web`: PASS
- `npm run test:api`: PASS (`25` archivos, `102` tests)

## Cuarta Pasada Global

En una iteracion enfocada exclusivamente en despliegue cPanel/iHosting se dejo implementado:

- `.cpanel.yml` en la raiz del repo;
- `build:cpanel` para compilar `shared`, `api` y `web` en el orden correcto;
- `start:prod` en `apps/api/package.json` para consistencia operacional;
- documentacion operativa minima alineada a `Git Version Control + Passenger + public_html`;
- scripts Docker de deploy marcados como legacy para no competir con la estrategia oficial.

Estado validado luego de esta cuarta pasada:

- `npm run build:cpanel`: PASS
- `npm run build:api`: PASS
- `npm run build:web`: PASS
- `npm run lint:api`: PASS
- `npm run lint:web`: PASS

Pendiente critico para usar Git deployment de cPanel:

- limpiar el working tree del repositorio.

## Lo Que Sigue Pendiente

- Activar AutoSSL y `Force HTTPS Redirect` en los dominios reales de frontend y API, y validar el certificado desde internet.
- Ejecutar las migraciones sobre una base MySQL de staging y realizar una prueba con datos persistidos.
- Validar OAuth, activos, webhook `leadgen`, CAPI y renovacion de credenciales con una aplicacion Meta real aprobada.
- Validar OAuth y sincronizaciones con credenciales reales de Google Ads, Analytics, Calendar y Drive.
- Completar el `.env` privado de cPanel y verificar secretos, URLs exactas y permisos de `UPLOAD_DIR`.
- Facturacion permanece postergada por decision de alcance; no debe presentarse como integracion contable terminada.

## Diferencias Relevantes Contra Documentacion Antigua

- El portal de cliente si existe en el frontend actual y sus rutas estan conectadas.
- El CRM no esta “solo mock”; hay backend real para leads/oportunidades/interacciones.
- Meta no estaba completamente roto, pero si tenia grietas reales en compilacion y boundaries de tenancy.
- El reporte anterior no adjunto omitio al menos un desajuste funcional importante: la UI de detalle de lead consumia un endpoint inexistente.
