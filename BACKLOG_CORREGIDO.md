# VitaHub — Backlog Corregido (verificado contra el código)

**Fecha:** 2026-07-24
**Método:** Lectura directa del repo (no inferencia)
**Reemplaza a:** `VITAHUB_AUDIT_REPORT.md`, `BACKLOG_MAESTRO_TODO.md`, `CONSOLIDACION_AUDIT_VS_BLUEPRINT.md`, `FASE_0_BACKLOG_DETALLADO.md` — **esos cuatro documentos contienen errores graves y no deben usarse.**

---

## ⚠️ PARTE 0: POR QUÉ SE CORRIGE

La auditoría previa fue generada por un subagente que **infirió ausencias sin leer el código**. Sus 5 "prioridades críticas" resultaron ser, en su mayoría, trabajo ya hecho.

| Hallazgo del audit | Realidad verificada | Evidencia |
|---|---|---|
| "Rate limiting 0% — CRÍTICO (4h)" | **Ya implementado** | `app.module.ts:82` `ThrottlerModule.forRoot([{ttl:60000,limit:100}])` + `APP_GUARD` línea 130; `@Throttle` por endpoint en public-reservations (10/min crear, 30/min events, 120/min slots), auth, meta, google, cron |
| "Testing <10%, sin tests de ReservationsService / Meta CAPI (58h)" | **49 archivos `.spec.ts`** | `test/unit/reservations/reservations.service.spec.ts`, `test/unit/integrations/meta-conversions.service.spec.ts`, `test/unit/crm/lead-intake.service.spec.ts`, +46 más. Runner: **vitest** (no Jest) |
| "Sin OpenAPI/Swagger (4h)" | **Ya configurado** | `main.ts:51-60` `DocumentBuilder` + `SwaggerModule.setup('api/docs')` |
| "Falta HSTS / security headers (2h)" | **helmet con CSP completo + CORS allowlist** | `main.ts:22-48` |
| "Sin audit logging (4h)" | **Módulo existe** | `src/core/audit/` |
| "Sin monitoring / health (5h)" | **Módulos existen** | `src/core/health/`, `src/core/observability/` |
| "Sin feature flags (8h)" | **Ya implementado** | `modules/clients/client-capabilities.ts` + migración `0032-client-capabilities.ts` |
| "Sin onboarding (10h)" | **Módulo existe** | `src/modules/onboarding/` |
| "Sin dashboards configurables (12h)" | **Módulo existe** | `src/modules/dashboards/` |

**Señal de alarma retrospectiva:** los límites de rate que "propuse" (10/min crear, 30/min events) eran casi idénticos a los que ya estaban en el código. Eso es reconstrucción plausible, no lectura.

**Módulos existentes** (28): account-cycles, approvals, audiovisual, billing, briefs, catalog, clients, content, contracts, crm, dashboards, design-budget, documents, gamification, integrations, knowledge, meetings, objectives, onboarding, operations, organizations, pods, production, reports, reservations, uploads, users, workflows

**Core existente** (15): audit, auth, authorization, client-scope, cloudinary, cron, data-protection, errors, events, health, jobs, notifications, observability, parameters, tenancy

---

## 🚨 PARTE 1: RESTRICCIÓN DE PLATAFORMA — iHosting / cPanel

**Ruta oficial de producción** (`docs/DEPLOY.md`, `.cpanel.yml`): iHosting con cPanel + Phusion Passenger + MySQL.

```yaml
# .cpanel.yml — despliegue real
- npm ci --include=dev
- npm run build:cpanel
- cp -R apps/web/dist/. $HOME/public_html
- touch $APP_ROOT/tmp/restart.txt   # ← Passenger restart
```

Docker Compose existe **solo para desarrollo local**, explícitamente marcado como "no es la ruta de producción soportada".

### Esto invalida arquitectónicamente gran parte del backlog anterior

| Propuesta anterior | Por qué NO aplica en iHosting | Alternativa correcta |
|---|---|---|
| Redis caching de slots (6h) | Shared hosting sin Redis | Caché en proceso (Map + TTL) o tabla MySQL de agregados |
| Bull queues (Bull + ioredis) | Requiere worker persistente; Passenger recicla el proceso | **Ya resuelto**: `core/cron` expone cron por HTTP, disparado por cron job de cPanel |
| Kubernetes / Helm / Terraform | No hay orquestador | `.cpanel.yml` (ya existe) |
| Prometheus + Grafana + agentes | No se pueden instalar agentes | `core/observability` + logs a archivo; consultar vía endpoint |
| Distributed tracing (OpenTelemetry) | Overhead inviable en shared hosting | Correlation IDs en logs (más simple, suficiente) |
| Microservicios / read replicas | Un solo proceso Passenger, una BD | Mantener monolito modular |
| PostgreSQL / `gen_random_uuid()` | La BD es **MySQL** (`mysql2`) | `uuid` npm (ya es dependencia) |

**Regla de oro para este proyecto:** toda propuesta debe funcionar con *un proceso Node bajo Passenger + MySQL + cron de cPanel*. Nada de daemons, brokers ni sidecars.

---

## ✅ PARTE 2: GAPS REALES VERIFICADOS

Estos sí faltan — confirmado con búsqueda exhaustiva que devolvió **cero coincidencias**.

### GAP 1 — Google Analytics 4 (GA4) 🟡 REAL
- **Verificación:** `grep -ri "ga4|measurement.?id|gtag"` → 0 resultados
- **Estado:** No existe tracking GA4. Meta Pixel sí existe (`MetaPixel.tsx`)
- **Encaja en iHosting:** ✅ Sí (script en frontend + config en BD)
- **Estimación:** 5h
- **Alcance:**
  - Campo `ga4MeasurementId` en `ReservationForm`
  - Componente `<Ga4Tag />` análogo a `MetaPixel.tsx`
  - Eventos: `reservation_created`, `reservation_attended`
  - Migración de BD

### GAP 2 — Geolocalización por IP 🟡 REAL
- **Verificación:** `grep -ri "geoip|geolocat|maxmind"` → 0 resultados
- **Estado:** La IP **sí se captura** (`clientIpAddress` en `Reservation`), pero no se resuelve a país/ciudad
- **Encaja en iHosting:** ⚠️ Con cuidado — MaxMind DB local (~70MB) es pesado para shared hosting
- **Estimación:** 4h
- **Alternativa recomendada:** leer cabecera `CF-IPCountry` si hay Cloudflare delante, o API externa con caché en MySQL. **Evitar** descargar la base MaxMind.
- **Decisión pendiente del usuario:** ¿hay Cloudflare delante de iHosting?

### GAP 3 — Importación masiva CSV 🟡 REAL
- **Verificación:** `grep -ri "bulk.?import|importCsv"` → 0 resultados
- **Estado:** La **exportación** existe (`ExportModal.tsx`); la importación no
- **Encaja en iHosting:** ✅ Sí — `papaparse` **ya es dependencia**; procesar por lotes para no agotar memoria
- **Estimación:** 8h
- **Restricción iHosting:** sin worker persistente → procesar en request con límite (p.ej. 1.000 filas/lote) o vía cron

### GAP 4 — Feature flags: granularidad insuficiente 🟡 PARCIAL
- **Estado real:** existe pero solo 3 claves
  ```typescript
  // client-capabilities.ts
  CLIENT_CAPABILITY_KEYS = ['reservations', 'crm', 'metaConversions']
  ```
- **Gap:** hay 28 módulos y solo 3 son activables. Sin granularidad por rol/entorno.
- **Encaja en iHosting:** ✅ Sí (columna JSON en MySQL)
- **Estimación:** 6h (extender, no reescribir)

### GAP 5 — Google Ads: conversiones offline ⚠️ POR VERIFICAR
- **Estado:** existe `google-data.service.ts` y `google.controller.ts`, pero no confirmé si sube conversiones offline a Google Ads o solo lee datos
- **Acción:** leer `google-data.service.ts` antes de estimar

---

## ❌ PARTE 3: DESCARTADO DEL BACKLOG ANTERIOR

No hacer. Ya existe, o no aplica a la plataforma.

| # | Task anterior | Motivo |
|---|---|---|
| 1 | Rate limiting (4h) | Ya existe |
| 2 | CSRF protection (3h) | Revisar necesidad real: API con JWT en header (no cookies) no es vulnerable a CSRF clásico |
| 3 | HTTPS/HSTS (2h) | helmet ya configurado; HTTPS lo gestiona cPanel |
| 4 | Audit logging (4h) | `core/audit` existe |
| 5 | Jest setup (8h) | Usan vitest, ya configurado |
| 6 | Structured logging (5h) | `core/observability` existe |
| 7-11 | Suite de tests (58h) | 49 spec files existen; medir cobertura real antes de estimar |
| 13 | Redis caching (6h) | No hay Redis en iHosting |
| 15 | Bull queues (3h) | `core/cron` + cron de cPanel ya cubre esto |
| 16-17 | Health/metrics/Grafana (6h) | `core/health` existe; Grafana no instalable |
| 18 | Feature flags (8h) | Existe (ver GAP 4 para la extensión real) |
| 23 | Onboarding wizard (10h) | `modules/onboarding` existe |
| 29 | Dashboard builder (12h) | `modules/dashboards` existe |
| 42-45 | Migrations/versioning/Swagger (14h) | Migraciones numeradas existen (0032, 0056...); Swagger existe |
| 49-52 | Tracing/Prometheus/Grafana/alertas (17h) | No instalables en shared hosting |
| 62-66 | Backups/replicación/microservicios/colas (30h) | No aplica a cPanel |

**Horas descartadas: ~190 de 349.**

---

## 📋 PARTE 4: BACKLOG REAL

| # | Task | Horas | Estado |
|---|---|---|---|
| 1 | GA4 tracking | 5h | ✅ Hecho (`1fa3de5`) |
| 2 | Ubicación aproximada → Meta CAPI | 4h | ✅ Hecho (`14d8470`) |
| 3 | Google Ads: servicio de conversiones | 6h | ✅ Hecho (`0de500b`) |
| 4 | Google Ads: outbox, cron y wiring | 7h | ✅ Hecho (`1f65746`) |
| 5 | Feature flag `googleConversions` | 2h | ✅ Hecho (`b605b25`) |
| 6 | Importación masiva CSV | 8h | ✅ Hecho (`3514651`) |
| 7 | Medir cobertura real de tests | 1h | ✅ Hecho (ver abajo) |

**Backlog vaciado.** 233/233 tests pasan, `tsc` limpio en API y web.

### Cobertura real de tests

Otra afirmación falsa de la auditoría: decía "<10%". La medición real
(`npm run test:cov` en `apps/api`) da:

| Métrica | Cobertura |
|---|---|
| Statements | 58.1% |
| Branches | 41.0% |
| Functions | 51.3% |
| **Lines** | **63.3%** |

Bien cubierto: `shared` 92.6%, `modules/integrations` 88.5%, `core/tenancy` 97.3%,
`modules/approvals` 85.1%.

Puntos débiles reales, si se quiere subir cobertura:
`core/client-scope` 5.6%, `core/errors` 43.1%, `core/audit` 51.9%,
`modules/crm/leads` 56.0%.

### Feature flags: por qué no se extendió a los 28 módulos

Añadir una clave por módulo habría sido cosmético: claves que no controlan
nada. Las capabilities valen cuando algo las verifica. Se añadió
`googleConversions`, que sí gatea el envío de datos personales a Google —
simétrica a `metaConversions` y desactivada por defecto.

### Resuelto: geolocalización sin proveedor externo

La pregunta era cómo saber la zona/región aproximada sin pagar un proveedor.
**No hace falta resolver la IP.** Tres señales gratis, en orden de cobertura:

1. **Meta ya geolocaliza por su cuenta** con el `client_ip_address` que le
   enviamos. Resolver la IP nosotros sería trabajo duplicado y exigiría una
   base tipo MaxMind (~70 MB), inviable en iHosting.
2. **País desde el prefijo E.164 del teléfono** — cubre el 100% de los
   números, móviles incluidos. Es un campo `user_data` propio que Meta **no**
   puede deducir de la IP, así que suma Match Quality de verdad.
3. **Región/ciudad desde el prefijo de red fija chilena** — sólo aplica a
   fijos (los móviles `+569` no codifican región), pero es exacto cuando aplica.

Implementado en `apps/api/src/shared/geo-inference.ts`, sin dependencias nuevas.

### Google Ads: circuito cerrado

La integración con Google era **solo de entrada**: `google-data.service.ts`
lee métricas de Ads y GA4 hacia `integration_metric`, pero nada reportaba
conversiones de vuelta. Y el `gclid` ya se capturaba en `Reservation.clickId`
desde la URL del anuncio, sin que ningún consumidor lo usara.

Ahora el circuito está completo:

- `GoogleConversionsService` construye y sube el payload (gclid o enhanced
  conversions con identificadores hasheados).
- `google_conversion_outbox` (migración 0058) da persistencia y reintentos con
  backoff exponencial, espejo de `meta_conversion_outbox`.
- `/cron/google-ads` y `/cron/google-ads/diagnostics`, disparados por el cron
  de cPanel igual que `meta-capi`.
- La acción de conversión por cliente se resuelve desde
  `IntegrationAccount.metadata.conversionActions`.

**Configuración pendiente del operador** (no es código): registrar el
`conversionActionId` de cada cliente en la cuenta de Ads correspondiente y
activarle la capability `googleConversions`. Sin eso, el envío se omite en
silencio y la reserva funciona igual.

---

## 🔍 PARTE 5: LECCIÓN DE PROCESO

1. **Un subagente de auditoría sin verificación produce ficción plausible.** Si un hallazgo dice "no existe X", exigir la ruta de archivo y el grep que lo demuestra.
2. **La plataforma de destino es una restricción de primer orden.** iHosting/cPanel debió filtrar el diseño desde el inicio; ~190h del backlog eran arquitectónicamente imposibles.
3. **Estimaciones sin lectura del código no valen nada.** 349h → 19h reales.

---

**Siguiente paso:** implementar GAP 1, 2 y 3 (los que no tienen bloqueos).
