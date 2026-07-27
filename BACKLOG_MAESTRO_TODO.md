> # ⛔ DOCUMENTO OBSOLETO — NO USAR
> De las 349h listadas, ~190h ya están implementadas o son imposibles en iHosting/cPanel
> (Redis, Bull, Kubernetes, Prometheus, microservicios, réplicas).
> **Ver [`BACKLOG_CORREGIDO.md`](BACKLOG_CORREGIDO.md).**

# VitaHub — Backlog Maestro (TODO — Sin Discriminar Fases)

**Filosofía:** Implementar EXHAUSTIVAMENTE todo lo requerido sin separación de fases  
**Timeline:** 349 horas (estimado 22-25 semanas a 16h/semana)  
**Equipo:** 3-4 dev backend + 2 frontend + 1 DevOps  
**Inicio:** 2026-07-25  
**Fin:** ~2027-01-15  

---

## PARTE 1: PRIORIZACIÓN EJECUTIVA (Qué Hacer Primero)

### 🔴 BLOCKERS INMEDIATOS (Hacer ahora - Semana 1-2)
Estas tareas debloquean TODO lo demás:

```
1. Rate limiting (4h) - Protege endpoints públicos
2. CSRF protection (3h) - Security baseline
3. Testing infrastructure (8h) - Necesario para todos
4. Structured logging (5h) - Observability baseline
```

**Total:** 20h (semana 1)

### 🟠 FOUNDATION (Semana 2-3)
Tareas que habilitan desarrollo seguro:

```
5. Unit tests ReservationsService (16h)
6. Unit tests MetaConversions (8h)
7. Unit tests LeadIntake (10h)
8. E2E tests (12h)
9. Monitoring setup (5h)
10. Redis caching (6h)
11. Audit logging (4h)
```

**Total:** 61h (semana 2-3)

### 🟡 CORE FEATURES (Semana 3-8)
Secciones 13-19 del blueprint (Feature flags, onboarding, dashboards, integraciones):

```
12. Feature flags system (8h)
13. Onboarding wizard (10h)
14. Dashboards configurables (12h)
15. Contact normalization (UUID refactor) (5h)
16. Geolocalización IP (4h)
17. Integración Google Ads (15h)
18. Integración Google GA4 (6h)
19. Integración centro (6h)
```

**Total:** 66h (semana 3-8)

### 🟢 ADVANCED FEATURES (Semana 8-22)
Bulk operations, analytics, integraciones extensibles:

```
20. Bulk operations (CSV import) (8h)
21. Bulk edit disponibilidad (6h)
22. Bulk export/reporting (5h)
23. Analytics avanzada - Conversiones (12h)
24. Analytics avanzada - Cohort (8h)
25. Analytics avanzada - Predictive (10h)
26. Analytics avanzada - Revenue (4h)
27. Integraciones - Zapier (6h)
28. Integraciones - Webhooks (5h)
29. Integraciones - Slack (4h)
30. Integraciones - SMS (Twilio) (6h)
```

**Total:** 74h (semana 8-22)

### 🔵 SCALING & INFRASTRUCTURE (Semana 15-25)
Database, microservices, production-ready:

```
31. Database migrations framework (4h)
32. Database backups (2h)
33. Database replication (4h)
34. API versioning (3h)
35. Deprecation policy (1h)
36. Refactor ReservationsService (8h)
37. Refactor validators (4h)
38. Dependency injection improvements (3h)
39. Distributed tracing (4h)
40. Prometheus metrics (4h)
41. Grafana dashboards (6h)
42. WCAG 2.1 audit (4h)
43. Mobile responsive QA (3h)
44. Performance profiling (4h)
45. SLA monitoring (2h)
46. Support playbook (3h)
47. Incident response (2h)
48. DB read replicas (4h)
49. Microservices separation (12h)
50. Queue-based processing (8h)
```

**Total:** 88h (semana 15-25)

---

## PARTE 2: BACKLOG CONSOLIDADO (Orden de Prioridad)

### 📍 PRIORIDAD 1: SECURITY & TESTING (27h)

**Razón:** Todo lo demás requiere esto funcionar

#### ✅ TASK 1: Rate Limiting
**Tiempo:** 4h | **Commits:** 1 | **Deps:** Redis
**Descripción:** Proteger endpoints públicos contra DOS/spam
**Archivos:**
- `src/core/rate-limiting/rate-limit.decorator.ts` (new)
- `src/core/rate-limiting/rate-limiter.service.ts` (new)
**Tests:** 2
**Definición hecha:** ✅ (ver FASE_0_BACKLOG_DETALLADO.md línea ~180)

---

#### ✅ TASK 2: CSRF Protection
**Tiempo:** 3h | **Commits:** 1
**Descripción:** CSRF tokens en responses, validation en requests
**Archivos:**
- `src/core/csrf/csrf.guard.ts` (new)
- `src/core/middlewares/csrf.middleware.ts` (new)
**Tests:** 2
**Definición hecha:** ✅ (ver FASE_0_BACKLOG línea ~220)

---

#### ✅ TASK 3: HTTPS & HSTS Headers
**Tiempo:** 2h | **Commits:** 1
**Descripción:** Security headers globales
**Archivos:**
- `src/main.ts` (modify)
- `nginx.conf` (modify/create)
**Tests:** 1 integration

---

#### ✅ TASK 4: Audit Logging Infrastructure
**Tiempo:** 4h | **Commits:** 2
**Descripción:** Log CREATE/UPDATE/DELETE en operaciones críticas
**Archivos:**
- `src/core/audit/audit-logger.service.ts` (new)
- Modify: `reservations.service.ts`, `crm.service.ts`, etc.
**Database:** `audit_logs` table
**Tests:** 3

---

#### ✅ TASK 5: Jest & Testing Infrastructure
**Tiempo:** 8h | **Commits:** 2
**Descripción:** Setup jest, mocks, fixtures, test database
**Archivos:**
- `jest.config.js` (new)
- `__tests__/fixtures/` (new directory)
- `__tests__/mocks/` (new directory)
- `__tests__/setup.ts` (new)
**Deps:** jest, ts-jest, @testing-library/react
**No Tests:** (es el setup)

---

#### ✅ TASK 6: Structured Logging
**Tiempo:** 5h | **Commits:** 1
**Descripción:** Winston/Pino + trace IDs + correlation
**Archivos:**
- `src/core/logging/logger.module.ts` (new)
- `src/core/logging/trace-id.middleware.ts` (new)
- `src/core/logging/http-logger.interceptor.ts` (new)
**Deps:** winston, @nestjs/common
**Tests:** 1 integration

---

### 📍 PRIORIDAD 2: CORE TESTING (56h)

**Razón:** Sin tests, no puedes refactorizar seguro

#### ✅ TASK 7: ReservationsService Unit Tests
**Tiempo:** 16h | **Commits:** 2
**Descripción:** 30+ tests para createReservation, updateReservation, slots, validation
**Archivo:** `src/modules/reservations/reservations.service.spec.ts` (new)
**Tests:** 30+
**Coverage Target:** >80%
**Definición hecha:** ✅ (ver línea ~550)

---

#### ✅ TASK 8: MetaConversionOutboxService Unit Tests
**Tiempo:** 8h | **Commits:** 1
**Descripción:** 10+ tests para queue, retry, cleanup
**Archivo:** `src/modules/meta/meta-conversion-outbox.service.spec.ts` (new)
**Tests:** 10+

---

#### ✅ TASK 9: LeadIntakeService Unit Tests
**Tiempo:** 10h | **Commits:** 1
**Descripción:** 15+ tests para dedup, scoring, status updates
**Archivo:** `src/modules/crm/lead-intake.service.spec.ts` (new)
**Tests:** 15+

---

#### ✅ TASK 10: Frontend Component Tests
**Tiempo:** 12h | **Commits:** 2
**Descripción:** React Testing Library para PublicReservationPage, ReservationsPage, FormBuilder, ExportModal
**Archivos:**
- `src/__tests__/PublicReservationPage.spec.tsx` (new)
- `src/__tests__/ReservationsPage.spec.tsx` (new)
- `src/__tests__/FormBuilderPage.spec.tsx` (new)
- `src/__tests__/ExportModal.spec.tsx` (new)
**Tests:** 8+
**Deps:** @testing-library/react, @testing-library/jest-dom

---

#### ✅ TASK 11: E2E Tests (Cypress/Playwright)
**Tiempo:** 12h | **Commits:** 1
**Descripción:** Full scenarios: create → attend, capacity enforcement, blocking
**Archivos:**
- `e2e/tests/create-and-attend-reservation.spec.ts` (new)
- `e2e/tests/capacity-enforcement.spec.ts` (new)
- `e2e/tests/availability-blocking.spec.ts` (new)
**Tests:** 3 end-to-end scenarios
**Deps:** cypress o playwright

---

#### ✅ TASK 12: Performance Tests & Load Testing
**Tiempo:** 2h | **Commits:** 1
**Descripción:** Verify 1000 reservations/min, p99 latency <500ms
**Archivo:** `load-testing/` (new)
**Tool:** k6 o artillery
**No Tests:** (es load test)

---

### 📍 PRIORIDAD 3: PERFORMANCE & INFRASTRUCTURE (19h)

**Razón:** Necesario antes de escalar

#### ✅ TASK 13: Redis Caching for Slots
**Tiempo:** 6h | **Commits:** 1
**Descripción:** Cache getAvailableSlots(), invalidate on changes
**Archivos:**
- `src/core/cache/cache.service.ts` (new)
- Modify: `reservations.service.ts`, `docker-compose.yml`
**Cache Key:** `slots:{formId}:{date}`
**TTL:** 1 hour
**Tests:** 2

---

#### ✅ TASK 14: Database Query Optimization
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Add missing indexes, optimize N+1 queries, JOIN relations
**Archivos:**
- Database migration (add indexes)
- Modify: `reservations.service.ts`, queries
**Indexes to Add:**
- `idx_reservations_form_date`
- `idx_leads_email_phone`
- `idx_meta_outbox_status`
**Tests:** 1 (verify no regression)

---

#### ✅ TASK 15: Async Lead Scoring
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Move lead scoring to background job (Bull queue)
**Archivos:**
- `src/core/queues/lead-scoring.queue.ts` (new)
- Modify: `lead-intake.service.ts`
**Deps:** @nestjs/bull, bull, ioredis
**Tests:** 1

---

#### ✅ TASK 16: Health Check & Metrics Endpoints
**Tiempo:** 4h | **Commits:** 1
**Descripción:** /health, /metrics (Prometheus format)
**Archivos:**
- `src/core/health/health.controller.ts` (new)
- `src/core/metrics/metrics.controller.ts` (new)
**Deps:** prom-client
**Tests:** 2

---

#### ✅ TASK 17: Monitoring Dashboard Setup
**Tiempo:** 2h | **Commits:** 1
**Descripción:** Grafana dashboard JSON with key panels
**Archivos:**
- `monitoring/grafana/dashboards/vitahub.json` (new)
- `monitoring/prometheus/prometheus.yml` (new)
**Panels:** Response time, error rate, DB latency, cache hit rate, Meta delivery

---

### 📍 PRIORIDAD 4: FEATURE FLAGS SYSTEM (8h)

**Razón:** Habilita rollout gradual de features

#### ✅ TASK 18: Feature Flags Service
**Tiempo:** 8h | **Commits:** 2
**Descripción:** Toggle capabilities per org/client/role/environment
**Archivos:**
- `src/core/feature-flags/feature-flags.service.ts` (new)
- `src/core/feature-flags/feature-flags.decorator.ts` (new)
- Database: `feature_flags` table
**Flags Example:**
```
- meta_capi_enabled (per org)
- google_calendar_enabled (per client)
- bulk_operations (per role)
- advanced_analytics (per plan)
- webhook_integrations (per org)
```
**Admin UI:** /admin/feature-flags
**Tests:** 3
**Definición completa:** Crear arquitectura completa

---

### 📍 PRIORIDAD 5: BLUEPRINT SECTION 1-12 (Validar, completar, refine)

#### ✅ TASK 19: Validar & Completar Página Pública Reserva
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Verificar 100%, agregar meta tracking si falta
**Verificar:**
- [ ] Form 3-step completo
- [ ] Meta Pixel inyectado
- [ ] FBC/FBP capturados
- [ ] IP + User Agent capturados
- [ ] Validación completa
**Tests:** 2

---

#### ✅ TASK 20: Validar & Completar Config Disponibilidad
**Tiempo:** 2h | **Commits:** 0 (sin cambios esperados)
**Descripción:** Verificar que todo funciona (debería estar 100%)
**Tests:** Verificar que existen

---

#### ✅ TASK 21: Validar & Completar CRM Contactos
**Tiempo:** 6h | **Commits:** 1
**Descripción:** Agregar dashboard de leads, mejorar filtering
**Archivos:**
- `src/features/crm/CrmLeadsPage.tsx` (modify/enhance)
- Add: Lead scoring visualization, funnel chart
**Tests:** 2

---

#### ✅ TASK 22: Validar Google Calendar Integration
**Tiempo:** 2h | **Commits:** 0 (verificación)
**Descripción:** Verificar que funciona y está documentado
**Tests:** 1 integration test

---

### 📍 PRIORIDAD 6: ONBOARDING FLOW (10h)

**Razón:** Critical path para nuevos clientes

#### ✅ TASK 23: 9-Step Onboarding Wizard
**Tiempo:** 10h | **Commits:** 2
**Descripción:** Country → Language → Modules → Integrations → Setup
**Archivos:**
- `src/features/onboarding/OnboardingWizard.tsx` (new, 400+ lines)
- `src/features/onboarding/OnboardingWizard.css` (new)
- `src/api/onboarding.controller.ts` (new)
**Steps:**
1. Welcome & language selection
2. Country selection (timezone, phone format)
3. Module selection (Reservations, CRM, Analytics, Integrations)
4. Meta configuration (pixel ID, access token)
5. Google configuration (calendar, analytics)
6. Custom fields setup
7. Availability configuration
8. Email templates
9. Review & activate

**Database:** `onboarding_progress` table
**Tests:** 3 (step flow, data persistence)

---

### 📍 PRIORIDAD 7: CONTACT NORMALIZATION (5h)

**Razón:** UUID key, E.164 phone, deduplication consistency

#### ✅ TASK 24: Refactor to UUID Primary Key
**Tiempo:** 5h | **Commits:** 2
**Descripción:** Change lead/contact PK from email/phone to UUID
**Archivos:**
- Database migration (new UUID column, backfill, drop old PK)
- Modify: Lead entity, Contact entity, relationships
- Update: queries, search logic
**Migration:**
```sql
ALTER TABLE leads ADD COLUMN id UUID DEFAULT gen_random_uuid();
UPDATE leads SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE leads DROP CONSTRAINT leads_pkey;
ALTER TABLE leads ADD PRIMARY KEY (id);
```
**Tests:** 2 (migration test, no data loss)

---

### 📍 PRIORIDAD 8: GEOLOCALIZACIÓN IP (4h)

**Razón:** Location-based features (future)

#### ✅ TASK 25: IP Geolocation Service
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Resolve client IP → country, city (for lead scoring, reporting)
**Archivos:**
- `src/core/geolocation/geolocation.service.ts` (new)
- Modify: `lead-intake.service.ts` (capture location)
**Deps:** `geoip2` (MaxMind GeoIP2) or `maxmind-db` (self-hosted)
**Database:** Add `client_country`, `client_city` to leads
**Tests:** 2 (valid IP, invalid IP)

---

### 📍 PRIORIDAD 9: GOOGLE INTEGRATIONS (21h)

**Razón:** Complete Google ecosystem

#### ✅ TASK 26: Google Ads Integration
**Tiempo:** 15h | **Commits:** 2
**Descripción:** Import conversions from Reservations → Google Ads
**Archivos:**
- `src/modules/integrations/google-ads/google-ads.service.ts` (new)
- `src/modules/integrations/google-ads/google-ads-conversion.outbox.ts` (new)
- `src/api/integrations/google-ads.controller.ts` (new)
**Flujo:**
1. Cliente configura Google Ads (API key, conversion ID)
2. Conversión enqueued en `google_ads_conversion_outbox`
3. Background job envía a Google Ads API
4. Retry logic (exponential backoff)
**Database:**
- `google_ads_client_config` (per org)
- `google_ads_conversion_outbox` (queue)
**Tests:** 3 (enqueue, send, retry)
**Deps:** `google-ads-api`

---

#### ✅ TASK 27: Google GA4 Integration
**Tiempo:** 6h | **Commits:** 1
**Descripción:** GA4 event tracking (reservations, attendance)
**Archivos:**
- `src/modules/integrations/ga4/ga4.service.ts` (new)
- Modify: `public-reservation.page.tsx` (inject GA4 pixel)
**Flujo:**
1. GA4 ID configurado en form
2. Emit events: reservation_created, reservation_attended
3. Custom user properties: client_id, lead_quality, utm_source
**Frontend:**
```typescript
gtag('event', 'reservation_created', {
  event_category: 'engagement',
  event_label: formId,
});
```
**Tests:** 2

---

#### ✅ TASK 28: Google Tag Manager (GTM) Configuration
**Tiempo:** 3h | **Commits:** 1
**Descripción:** GTM setup guide + container template export
**Archivos:**
- `docs/gtm-setup.md` (new)
- `gtm-container-template.json` (new)
**Documentar:**
- Data layer structure
- Triggers setup
- Tag configuration
- QA steps

---

### 📍 PRIORIDAD 10: DASHBOARDS CONFIGURABLES (12h)

**Razón:** Key feature para analytics avanzado

#### ✅ TASK 29: Dashboard Builder Service
**Tiempo:** 12h | **Commits:** 2
**Descripción:** Save/load custom dashboards con widget picker
**Archivos:**
- `src/modules/dashboards/dashboard.service.ts` (new)
- `src/features/dashboards/DashboardBuilder.tsx` (new, 600+ lines)
- `src/features/dashboards/DashboardBuilder.css` (new)
- Database: `dashboards`, `dashboard_widgets` tables
**Features:**
- Drag-drop widget placement
- 7 prebuilt templates (A-G por persona)
- Widget library (20+ widgets)
- Export dashboard as JSON
- Share dashboard link
**Prebuilt Templates:**
- A: Owner (conversions, revenue, top sources)
- B: Sales Manager (pipeline, lead score distribution, conversion rate)
- C: Scheduling Manager (capacity, attendance, no-shows)
- D: Marketing (traffic, pixel events, ROI by campaign)
- E: Analyst (all metrics, cohort analysis, predictive)
- F: Support (response time, satisfaction, ticket volume)
- G: Executive (KPIs, MoM growth, forecast)
**Tests:** 3

---

### 📍 PRIORIDAD 11: INTEGRACIÓN CENTRO (6h)

**Razón:** Centralized configuration panel

#### ✅ TASK 30: Integration Center
**Tiempo:** 6h | **Commits:** 1
**Descripción:** Unified panel for all integrations (status, auth, config)
**Archivos:**
- `src/features/integrations/IntegrationCenter.tsx` (new, 400+ lines)
- `src/api/integrations.controller.ts` (modify)
**Features:**
- Status dashboard (connected/disconnected/error)
- Auth flows (OAuth for Google, Meta, etc.)
- Configuration forms per integration
- Test connection button
- Logs/events for each integration
**Integrations shown:**
- Meta (Pixel, CAPI)
- Google (Calendar, Ads, GA4, GTM)
- Slack
- Twilio
- Zapier
- Webhooks
**Tests:** 2

---

### 📍 PRIORIDAD 12: BULK OPERATIONS (19h)

**Razón:** Multi-client scale feature

#### ✅ TASK 31: Bulk Import Reservations (CSV)
**Tiempo:** 8h | **Commits:** 1
**Descripción:** Upload CSV → import 1000s of reservations
**Archivos:**
- `src/features/reservations/BulkImportModal.tsx` (new)
- `src/modules/reservations/bulk-import.service.ts` (new)
- `src/api/reservations/bulk-import.controller.ts` (new)
**Features:**
- CSV validation (required columns)
- Preview before import
- Background job processing
- Progress tracking
- Error report (downloadable)
**Column mapping:**
- name, email, phone, date, time, notes, etc.
- Auto-match to form fields
**Limits:**
- Max 10,000 rows per file
- Max 5 uploads/day per org
**Database:** `bulk_import_jobs` table
**Tests:** 2

---

#### ✅ TASK 32: Bulk Edit Availability
**Tiempo:** 6h | **Commits:** 1
**Descripción:** Change availability for multiple dates at once
**Archivos:**
- `src/features/forms/BulkEditAvailability.tsx` (new)
- `src/modules/reservations/bulk-availability.service.ts` (new)
**Features:**
- Date range picker
- Copy availability from template
- Apply to all days in range
- Undo capability
**Tests:** 2

---

#### ✅ TASK 33: Bulk Export & Reporting
**Tiempo:** 5h | **Commits:** 1
**Descripción:** Export 1000s of reservations with advanced filtering
**Archivos:**
- `src/features/reservations/BulkExportModal.tsx` (enhance existing)
- `src/modules/reservations/bulk-export.service.ts` (new)
**Formats:**
- CSV (configurable columns)
- JSON (nested structure)
- PDF (formatted report with charts)
- Excel (multiple sheets)
**Filters:**
- Date range
- Status filter
- Lead quality filter
- Custom field filtering
**Limits:** Async processing for >5000 rows
**Tests:** 2

---

### 📍 PRIORIDAD 13: ADVANCED ANALYTICS (34h)

**Razón:** Business intelligence para clientes

#### ✅ TASK 34: Conversions Dashboard
**Tiempo:** 12h | **Commits:** 1
**Descripción:** Conversion funnel, source attribution, ROI tracking
**Archivos:**
- `src/features/analytics/ConversionsDashboard.tsx` (new, 400+ lines)
- `src/modules/analytics/conversions.service.ts` (new)
**Metrics:**
- Funnel: form views → reservations → attended
- By source (direct, utm_source, Facebook, Google, etc.)
- By campaign (if UTM present)
- ROI per source (cost / conversions)
- Time to convert (first visit → reservation)
**Charts:**
- Funnel chart (Plotly)
- Attribution pie chart
- Timeline (conversions over time)
- Source comparison (bar chart)
**Tests:** 2

---

#### ✅ TASK 35: Cohort Analysis
**Tiempo:** 8h | **Commits:** 1
**Descripción:** Track cohorts of users (by signup date, source, etc.)
**Archivos:**
- `src/features/analytics/CohortAnalysis.tsx` (new)
- `src/modules/analytics/cohort.service.ts` (new)
**Features:**
- Define cohort (date range, segment)
- Track retention (1d, 7d, 30d return rate)
- Cohort matrix visualization
- Export cohort data
**Tests:** 2

---

#### ✅ TASK 36: Predictive Capacity Planning
**Tiempo:** 10h | **Commits:** 1
**Descripción:** Forecast peak demand, recommend staffing levels
**Archivos:**
- `src/features/analytics/CapacityForecast.tsx` (new)
- `src/modules/analytics/forecast.service.ts` (new)
**Algorithm:**
- Historical reservation patterns
- Seasonal adjustment
- ML simple (ARIMA or Prophet)
- Forecast 30/90 days ahead
**Output:**
- Peak days (recommend +staff)
- Low-demand days (recommend -staff)
- Revenue forecast
**Tests:** 2

---

#### ✅ TASK 37: Revenue Tracking
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Track revenue by service, client, campaign
**Archivos:**
- `src/features/analytics/RevenueMetrics.tsx` (new)
- Modify: `reservation.entity.ts` (add revenue_amount field)
**Metrics:**
- Total revenue (by period)
- Revenue by service type
- Revenue per lead source
- Lifetime customer value
- Churn analysis
**Tests:** 1

---

### 📍 PRIORIDAD 14: EXTENDED INTEGRATIONS (21h)

**Razón:** Ecosystem expansion

#### ✅ TASK 38: Zapier Integration
**Tiempo:** 6h | **Commits:** 1
**Descripción:** VitaHub ↔ Zapier (triggers: reservation_created, attendance_marked)
**Archivos:**
- `src/modules/integrations/zapier/zapier.service.ts` (new)
- `src/api/integrations/zapier.controller.ts` (new)
- Documentation (Zapier app JSON)
**Triggers:**
- `reservation_created` → payload with all fields
- `reservation_attended` → lead status update
- `lead_created` → lead data
- `form_updated` → config changes
**Tests:** 2

---

#### ✅ TASK 39: Webhooks Framework
**Tiempo:** 5h | **Commits:** 1
**Descripción:** Custom webhooks to any endpoint
**Archivos:**
- `src/modules/webhooks/webhooks.service.ts` (new)
- `src/modules/webhooks/webhook-delivery.outbox.ts` (new)
- `src/api/webhooks.controller.ts` (new)
**Features:**
- Register webhook endpoints
- Select events to subscribe to
- Retry logic (exponential backoff)
- Delivery logs + replay
**Events:**
- reservation.created
- reservation.updated
- lead.created
- lead.updated
- form.updated
**Database:** `webhooks`, `webhook_deliveries`
**Tests:** 3

---

#### ✅ TASK 40: Slack Integration
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Send notifications to Slack (reservations, alerts)
**Archivos:**
- `src/modules/integrations/slack/slack.service.ts` (new)
- `src/api/integrations/slack.controller.ts` (new)
**Features:**
- Connect Slack workspace (OAuth)
- Select channel for notifications
- Customizable messages
- Format: rich blocks (reservation details, lead info)
**Notifications:**
- New reservation (with client details)
- No-show alerts (red flag)
- High-quality lead captured
- Form capacity reached
**Database:** `slack_integrations`
**Tests:** 2

---

#### ✅ TASK 41: SMS Gateway (Twilio)
**Tiempo:** 6h | **Commits:** 1
**Descripción:** SMS confirmation + reminders
**Archivos:**
- `src/core/sms/sms.service.ts` (new)
- `src/modules/reservations/sms-notifications.service.ts` (new)
**Features:**
- SMS templates (configurable)
- Send on: reservation_created, 24h before, attendance_marked
- Track delivery + open rates
- Opt-out management
**Twilio setup:**
- Account SID + Auth Token
- Phone number allocation
**Database:** `sms_logs`, `sms_opt_outs`
**Tests:** 2

---

### 📍 PRIORIDAD 15: API QUALITY & DOCUMENTATION (14h)

**Razón:** Production-ready professional API

#### ✅ TASK 42: Database Migrations Framework
**Tiempo:** 4h | **Commits:** 1
**Descripción:** TypeORM migrations + versioning
**Archivos:**
- Setup TypeORM CLI
- Create migration structure
- Document migration policy
- Modify: `ormconfig.ts`
**Policies:**
- Always create down() for rollback
- Never use raw SQL (use QueryBuilder)
- Test migrations in CI/CD
- Backup before migration

---

#### ✅ TASK 43: API Versioning
**Tiempo:** 3h | **Commits:** 1
**Descripción:** v1 endpoints stable, support v2 in parallel
**Archivos:**
- Create: `src/v1/` and `src/v2/` directories
- Modify: controllers to support both versions
**Deprecation:**
- v1 deprecated after 90 days
- v2 default for new clients
**Documentation:** Version migration guide

---

#### ✅ TASK 44: OpenAPI/Swagger
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Full API documentation + auto-generated client
**Archivos:**
- `src/main.ts` (setup SwaggerModule)
- Decorate all controllers/endpoints
- Generate: `openapi-schema.json`
**Deliverables:**
- Interactive Swagger UI (/api/docs)
- ReDoc UI (/api/docs-redoc)
- Type-safe TypeScript client (auto-generated)
- Postman collection

---

#### ✅ TASK 45: Deprecation Policy & Changelog
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Document deprecation timeline, auto-generate changelog
**Archivos:**
- `DEPRECATION_POLICY.md` (new)
- `CHANGELOG.md` (auto-generated from commits)
- `docs/migration-guides/` (per version)
**Tools:** semantic-versioning, auto-changelog

---

### 📍 PRIORIDAD 16: CODE QUALITY & REFACTORING (15h)

**Razón:** Maintainability para future features

#### ✅ TASK 46: Refactor ReservationsService
**Tiempo:** 8h | **Commits:** 2
**Descripción:** Split 720-line file into 3 services
**Current:**
```
ReservationsService (720 lines)
├─ createReservation()
├─ updateReservation()
├─ getAvailableSlots()
└─ validateConfiguration()
```
**Target:**
```
ReservationFormService (forms CRUD)
ReservationSlotService (availability logic)
ReservationService (core reservations)
```
**Tests:** Ensure existing tests pass (no behavioral change)

---

#### ✅ TASK 47: Extract Validators
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Move validation logic to separate validator classes
**Files:**
- `src/core/validators/schedule-config.validator.ts`
- `src/core/validators/field-schema.validator.ts`
- `src/core/validators/capacity.validator.ts`
**Usage:**
```typescript
const errors = await scheduleConfigValidator.validate(config);
```

---

#### ✅ TASK 48: Dependency Injection Improvements
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Use NestJS DI properly, reduce manual instantiation
**Archivos:**
- Create `*.module.ts` files for each domain
- Dependency injection everywhere (no `new` keyword)
- Lazy loading for optional dependencies

---

### 📍 PRIORIDAD 17: OBSERVABILITY & MONITORING (20h)

**Razón:** Production visibility

#### ✅ TASK 49: Distributed Tracing
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Trace requests across services (Jaeger/Zipkin)
**Archivos:**
- `src/core/tracing/tracing.module.ts` (new)
- Setup OpenTelemetry
**Deps:** `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`

---

#### ✅ TASK 50: Prometheus Metrics
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Export metrics for Prometheus scraping
**Archivos:**
- `src/core/metrics/metrics.service.ts` (enhance)
**Metrics:**
- HTTP requests (count, latency)
- Database queries (count, latency)
- Reservation creation rate
- Meta event delivery rate
- Cache hit rate
- Queue size (Bull)

---

#### ✅ TASK 51: Grafana Dashboards
**Tiempo:** 6h | **Commits:** 1
**Descripción:** Production dashboards (5 boards)
**Boards:**
1. Overview (KPIs, uptime, errors)
2. Performance (API latency, DB, cache)
3. Business (reservations, leads, revenue)
4. Integrations (Meta, Google, Slack status)
5. Infrastructure (CPU, memory, disk, connections)

---

#### ✅ TASK 52: Alert Rules & Notifications
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Prometheus alerts + Alertmanager
**Alerts:**
- High error rate (>5%)
- API latency p99 >1s
- Database down
- Redis down
- Meta delivery <95%
**Notifications:** Slack, PagerDuty (for critical)

---

#### ✅ TASK 53: Audit Log Visualization
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Admin UI to view/search audit logs
**Archivos:**
- `src/features/admin/AuditLogViewer.tsx` (new)
- `src/api/admin/audit-logs.controller.ts` (new)
**Features:**
- Search by user, resource, date range
- Filter by action (CREATE, UPDATE, DELETE)
- Export audit logs
- Alert on suspicious activity (bulk deletes)

---

### 📍 PRIORIDAD 18: SECURITY & COMPLIANCE (15h)

**Razón:** Production readiness

#### ✅ TASK 54: WCAG 2.1 AA Audit
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Accessibility audit + fixes
**Check:**
- Color contrast (WCAG AA minimum 4.5:1)
- Keyboard navigation (all interactive elements)
- Screen reader support (aria-labels, roles)
- Focus indicators
- Mobile touch targets (48px minimum)
**Tools:** axe DevTools, Lighthouse, manual testing
**Fixes:** Document all changes

---

#### ✅ TASK 55: Mobile Responsive QA
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Test all flows on mobile (iOS/Android)
**Devices:**
- iPhone 12 (375w)
- iPhone 14 Pro (393w)
- Pixel 6a (412w)
- iPad (768w)
**Test:**
- Form submission flow
- Reservation list
- Settings page
- Export modal
- Notifications

---

#### ✅ TASK 56: Performance Profiling
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Identify bottlenecks with Lighthouse/DevTools
**Targets:**
- First Contentful Paint <2s
- Largest Contentful Paint <3s
- Cumulative Layout Shift <0.1
- Time to Interactive <3.5s
**Optimizations:**
- Code splitting
- Lazy loading
- Image optimization
- CSS/JS minification

---

#### ✅ TASK 57: Security Hardening Final
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Final security audit + fixes
**Check:**
- No secrets in code (scan with truffleHog)
- No XSS vulnerabilities (CSP headers, sanitization)
- No SQL injection (verify TypeORM parameterized)
- HTTPS enforced
- Security headers present
- CORS properly configured
- Dependency vulnerabilities (audit npm packages)

---

### 📍 PRIORIDAD 19: DOCUMENTATION & OPERATIONS (12h)

**Razón:** Support and handoff

#### ✅ TASK 58: Deployment Guide
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Complete deployment instructions
**Content:**
- Pre-deployment checklist
- Step-by-step deployment (Docker, K8s, Helm)
- Rollback procedures
- Post-deployment verification
- Troubleshooting

---

#### ✅ TASK 59: Operational Runbook
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Day-2 operations guide
**Content:**
- Common issues and fixes
- Database maintenance (backups, indexes)
- Log analysis (finding errors)
- Scaling procedures
- Monitoring alerts interpretation

---

#### ✅ TASK 60: Architecture Decision Records (ADRs)
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Document key architectural decisions
**Examples:**
- Why dnd-kit for drag-drop?
- Why Redis for caching?
- Why Bull for queuing?
- Why microservices for Meta integration?
**Format:** ADR template with context, decision, consequences

---

#### ✅ TASK 61: Developer Setup Guide
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Quick start for new developers
**Content:**
- Install dependencies (Node, Docker, etc.)
- Setup local DB + Redis
- Run dev server
- Run tests
- Common workflows (creating feature, testing, debugging)

---

### 📍 PRIORIDAD 20: DATABASE & INFRASTRUCTURE (24h)

**Razón:** Production scale

#### ✅ TASK 62: Database Backup Automation
**Tiempo:** 2h | **Commits:** 1
**Descripción:** Daily backups + restore testing
**Setup:**
- AWS RDS automated backups (7-day retention)
- Manual backups on production changes
- Restore test monthly
- Point-in-time recovery enabled

---

#### ✅ TASK 63: Database Replication
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Primary-replica setup for high availability
**Setup:**
- Primary in us-east-1
- Replica in us-west-2 (async replication)
- Automatic failover (Route53 health check)
- Read-heavy queries on replica

---

#### ✅ TASK 64: Database Read Replicas
**Tiempo:** 4h | **Commits:** 1
**Descripción:** Route analytics queries to replica
**Setup:**
- Create 2nd replica for analytics
- Use read-only connection string for reporting
- Separate connection pool

---

#### ✅ TASK 65: Microservices Preparation
**Tiempo:** 12h | **Commits:** 2
**Descripción:** Refactor toward microservices (optional, future-ready)
**Candidates for separation:**
- Meta integration service (standalone)
- Analytics service (BigQuery/Snowflake backend)
- CRM service (separate DB)
- Integrations service (webhooks, Slack, etc.)
**Current:** Monolithic, ready to split
**Timeline:** Phase 2+

---

#### ✅ TASK 66: Queue-based Processing
**Tiempo:** 8h | **Commits:** 2
**Descripción:** Async jobs for heavy operations
**Jobs:**
- Lead scoring (already done)
- Meta event delivery
- Email sending
- Bulk imports
- Report generation
- Webhook delivery
**Backend:** Bull + Redis

---

### 📍 PRIORIDAD 21: FINAL POLISH & QA (5h)

#### ✅ TASK 67: Visual Regression Testing
**Tiempo:** 2h | **Commits:** 1
**Descripción:** Screenshot testing (Percy or Chromatic)
**Coverage:**
- All pages (desktop + mobile)
- All component states (hover, active, disabled)
- All themes (light, dark)

---

#### ✅ TASK 68: Bug Hunt & Fix Pass
**Tiempo:** 3h | **Commits:** 1
**Descripción:** Final round of bug fixes
**Process:**
- QA testing across all features
- Document all bugs
- Fix high/medium severity
- Document remaining low-severity

---

---

## PARTE 3: ESTIMACIÓN TOTAL & RECURSOS

### Resumen por Área

| Área | # Tasks | Horas | Semanas (16h/wk) |
|---|---|---|---|
| Security & Testing | 12 | 83 | 5.2 |
| Performance | 3 | 13 | 0.8 |
| Feature Flags | 1 | 8 | 0.5 |
| Onboarding | 1 | 10 | 0.6 |
| Contact Normalization | 1 | 5 | 0.3 |
| Geolocation | 1 | 4 | 0.25 |
| Google Integration | 3 | 21 | 1.3 |
| Dashboards | 1 | 12 | 0.75 |
| Integration Center | 1 | 6 | 0.4 |
| Bulk Operations | 3 | 19 | 1.2 |
| Advanced Analytics | 4 | 34 | 2.1 |
| Extended Integrations | 4 | 21 | 1.3 |
| API Quality | 4 | 14 | 0.9 |
| Code Quality | 3 | 15 | 0.9 |
| Observability | 5 | 20 | 1.25 |
| Security Final | 1 | 4 | 0.25 |
| Documentation | 4 | 12 | 0.75 |
| Infrastructure | 5 | 24 | 1.5 |
| Final Polish | 2 | 5 | 0.3 |
| **TOTAL** | **68** | **349** | **22.2** |

### Equipo Recomendado

- **2-3 Backend Developers** (NODE/NestJS) - 80 horas each
- **2 Frontend Developers** (React) - 60 horas each
- **1 DevOps/SRE** - 40 horas
- **1 QA Engineer** - 30 horas
- **1 Product/Tech Lead** - Oversight

### Timeline

- **Start:** 2026-07-25
- **Midpoint (50%):** 2026-11-20 (17 weeks)
- **Finish:** 2027-01-15 (26 weeks / ~6 months)

### Parallelization Strategy

**Weeks 1-2:** Security + Testing foundation (all tasks in priority 1-2)
**Weeks 2-4:** Testing build-out + performance work (parallel)
**Weeks 4-22:** Feature development (multiple streams)
**Weeks 20-26:** Polish + QA (overlap with feature work)

---

## PARTE 4: NEXT STEPS

1. ✅ **User Review & Validation** - Confirm this backlog is complete
2. ✅ **Identify Blockers** - Any tech dependencies missing?
3. ✅ **Assign Tasks** - Who owns which tasks?
4. ✅ **Setup Repo** - Create task tracking in GitHub/Linear
5. ✅ **Day 1 Kickoff** - Start TASK 1 (Rate Limiting)

---

**DOCUMENTO MAESTRO:** Este backlog es la fuente de verdad para TODO trabajo en VitaHub  
**ACTUALIZACIÓN:** Se actualiza cuando nuevos requerimientos emergen  
**RESPONSABILIDAD:** Tech Lead + Product Owner revisan weekly  

---

**¿Listo para comenzar?** 🚀
