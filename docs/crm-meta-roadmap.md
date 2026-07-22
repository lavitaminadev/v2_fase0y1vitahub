# CRM + Meta: operacion, seguridad y App Review

Fecha de revision: 2026-07-16

## Alcance segun Documento Maestro

Meta es una fuente de prospectos, mensajeria y resultados publicitarios para la operacion interna de La Vitamina. El CRM mantiene una sola fuente de verdad desde prospecto hasta oportunidad, cliente y resultado. La aplicacion no ofrece cuentas aisladas como SaaS: el administrador conecta los activos que La Vitamina gestiona y los asigna a su operacion.

## Flujo funcional actual

1. Un administrador conecta Meta mediante OAuth.
2. El servidor cambia el token corto por uno de larga duracion y lo cifra con AES-256-GCM.
3. El administrador descubre paginas, perfiles de Instagram y cuentas publicitarias reales.
4. Al guardar paginas, el servidor suscribe `leadgen` y los campos de mensajeria autorizados.
5. Meta llama `POST /api/webhooks/meta` sin JWT; el endpoint solo acepta una firma `X-Hub-Signature-256` valida.
6. El servidor registra el evento tecnico, descarga el lead, normaliza campos y deduplica por ID externo, email o telefono.
7. El CRM calcula encaje, crea interaccion y, cuando corresponde, contacto y oportunidad.
8. El equipo mueve el lead por el kanban y puede descartarlo, exportarlo o anonimizarlo.
9. El job de retencion anonimiza leads descartados cuya fecha de revision vencio.

No se usan datos mock en este flujo. La sincronizacion manual por `pageId` y `leadgenId` es una herramienta de soporte limitada por tasa; no reemplaza el webhook.

## Credenciales y limites de confianza

- Los tokens OAuth y de pagina se cifran antes de persistirlos.
- `INTEGRATION_ENCRYPTION_KEY` es obligatorio en produccion y debe ser distinto de `JWT_SECRET`.
- Las respuestas de `/api/integrations` eliminan tokens, secretos y API keys de `config`.
- Pixel se valida con la credencial del servidor; la UI nunca solicita un access token.
- La prueba de Conversions API requiere `META_TEST_EVENT_CODE` y usa un identificador sintetico con hash SHA-256.
- Los payloads externos tienen timeout, firma o validacion de borde segun corresponda.

Los registros antiguos en texto plano siguen siendo legibles para permitir una migracion sin corte, pero se cifran al reconectar, refrescar o redescubrir activos. Antes de produccion se debe reconectar Meta y confirmar `Credenciales: Cifradas` en Integraciones.

## Eliminacion solicitada por Meta

Configurar en Meta App Dashboard:

- Data Deletion Request URL: `https://API_PUBLICA/api/webhooks/meta/data-deletion`
- Webhook Callback URL: `https://API_PUBLICA/api/webhooks/meta`
- Verify Token: el valor secreto de `META_WEBHOOK_VERIFY_TOKEN`

El callback de eliminacion:

1. recibe `signed_request` como formulario;
2. verifica HMAC-SHA256 con `META_APP_SECRET`;
3. identifica la conexion por el ID app-scoped guardado durante OAuth;
4. elimina activos y credenciales asociados;
5. desactiva la integracion;
6. responde `url` y `confirmation_code` en el formato requerido por Meta.

## Checklist de Meta App Review

- Caso de uso demostrado: capturar Lead Ads en el CRM interno de La Vitamina, reconciliar prospectos y devolver eventos de compra por CAPI.
- Permisos obligatorios requeridos: `leads_retrieval`, `pages_manage_ads`, `pages_show_list` y `pages_read_engagement`.
- Video de revisión: conectar cuenta, descubrir activos, generar lead de prueba, ver lead en CRM en el Kanban, convertirlo a cliente (disparando evento CAPI) y anonimizarlo desde el Side Drawer.
- Proporcionar usuario de revisión con rol mínimo suficiente y datos de prueba reales de Meta.
- Publicar política de privacidad accesible por HTTPS y configurar el callback de eliminación.
- Ejecutar llamadas exitosas con cada permiso antes de enviar App Review.
- Confirmar que la app esta en modo Live y que Business Verification/Access Verification aplicable esta aprobada en el panel de Meta.

La aplicacion no puede confirmar por API el estado administrativo de App Review. Ese estado se verifica en Meta App Dashboard y se conserva como evidencia operativa, no como un indicador inventado en VITAHUB.

## Proteccion de datos en Chile

La Ley 21.719 entra en vigencia el 1 de diciembre de 2026. Los controles tecnicos actuales cubren minimizacion, acceso por rol, trazabilidad, exportacion, anonimizacion y retencion configurable. La base juridica, los plazos definitivos, el canal formal para titulares y los textos informativos deben ser validados por asesoria legal de La Vitamina.

Fuente oficial: https://www.bcn.cl/leychile/N?i=1209272&t=0

## Configuracion obligatoria

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v23.0
META_WEBHOOK_VERIFY_TOKEN=
META_TEST_EVENT_CODE=
META_CONVERSIONS_ACCESS_TOKEN=
API_PUBLIC_URL=https://api.example.com/api
INTEGRATION_ENCRYPTION_KEY=<32-bytes-base64-or-64-hex>
OAUTH_STATE_SECRET=<random-secret>
CRM_LEAD_RETENTION_DAYS=
```

## Verificacion antes de produccion

- OAuth completa y vuelve a `/integrations/meta/callback`.
- La pantalla muestra credenciales cifradas.
- Descubrimiento devuelve activos de Meta reales.
- Guardar seleccion confirma la suscripcion de pagina; un error de Meta no se oculta.
- El webhook GET responde el challenge correcto.
- Un webhook POST con firma invalida devuelve 401.
- Un Lead Ads de prueba aparece una sola vez en CRM.
- Pixel valida sin enviar token desde el navegador.
- Conversions API aparece en Test Events de Events Manager.
- El callback de eliminacion devuelve URL y codigo y desactiva la conexion correspondiente.

## Optimizaciones Implementadas (Fase 2 y 3)

1. **Reconciliación Automática (Job):** `MetaLeadRecoveryJob` corre cada 4h recuperando leads directamente por Graph API para asegurar 0% pérdida ante caídas de webhooks.
2. **Atribución Closed-Loop (CAPI):** `LeadConvertedHandler` dispara un evento `Purchase` seguro y hasheado a la API de Conversiones cuando un prospecto cambia a estado Ganado/Cliente en el CRM, mejorando el CPA.
3. **Transacciones ACID:** Conversión de Lead protegida por transacciones TypeORM.

## Futuras implementaciones priorizadas

1. Interfaz visual (Modal) para mapeo dinámico de campos personalizados de Lead Ads.
2. Bandeja unificada de Mensajería (Inbox) para Instagram Direct y Messenger.
3. Dashboard de calidad de campaña (conversión real en CRM vs clics).

## Dependencias verificadas

La migracion coordinada a NestJS 11, Express 5 y Vite 8 se completo sin usar `npm audit fix --force`. El monorepo usa un unico `package-lock.json` en la raiz; `npm audit` y `npm audit --omit=dev` reportan cero vulnerabilidades. CI vuelve a verificar auditoria de produccion, lint, pruebas y builds en cada cambio.

## Decisiones que el Maestro mantiene abiertas

- Plazo real de retencion por categoria de lead.
- Formularios y campanas que representan ICP alto.
- Umbral definitivo para crear oportunidad automatica.
- Responsable comercial por rubro o cuenta.
- Evento comercial que se enviara de vuelta a Meta.
- Plataformas de reserva y CRM externo para reporteria final.

Estas decisiones no se fijan en codigo hasta que Direccion las apruebe.
