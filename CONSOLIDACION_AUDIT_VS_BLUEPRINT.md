> # ⛔ DOCUMENTO OBSOLETO — NO USAR
> Basado en una auditoría incorrecta. **Ver [`BACKLOG_CORREGIDO.md`](BACKLOG_CORREGIDO.md).**

# VitaHub — Consolidación: Auditoría ↔ Blueprint Definitivo

**Fecha:** 2026-07-24  
**Propósito:** Alinear findings de auditoría con arquitectura de 25 secciones  
**Estado:** 🟢 Listo para ejecutar (Fase 0 inmediata)

---

## PARTE 1: MATRIZ DE ALINEACIÓN (Audit vs Blueprint)

### ✅ COMPLETAMENTE ALINEADO (100% → 100%)

| Sección Blueprint | Requerimiento | Estado Audit | Notas |
|---|---|---|---|
| **1. Página Pública Reserva** | Formulario 3-step con Meta Pixel | ✅ 100% | Implementado, testeado, UI premium |
| **2. Config Disponibilidad** | Windows, buffers, capacidad, timezone | ✅ 100% | Validación exhaustiva, índices presentes |
| **3. Bloqueos de Fechas** | AvailabilityBlock entity + endpoint | ✅ 100% | Funcional, auditable |
| **4. Bandeja de Reservas** | Listar, filtrar, paginar, marcar asistencia | ✅ 100% | StatusTrafficLight implementado |
| **5. CRM Contactos** | Lead + scoring + deduplicación | ✅ 95% | Scoring sofisticado, falta dashboard |
| **6. Meta CAPI Schedule** | Evento al crear reserva | ✅ 100% | Hash correcto, test event code, retry |
| **7. Meta CAPI Asistencia** | Evento al marcar attended | ✅ 100% | Reserva_Asistida, window 62 días |
| **8. Validación Capacidad** | dailyCapacity + per-slot | ✅ 100% | Líneas 296-303, robusta |
| **9. Multi-tenant** | Aislamiento org/cliente | ✅ 100% | Scope checking perfecto |
| **10. Permisos Básicos** | Roles team/client/manager | ✅ 85% | Implementado, falta RBAC granular |
| **11. Google Calendar** | Integración (EXTRA) | ✅ 90% | Funcional, no documentado |
| **12. UI/UX Premium** | Paleta corporativa, icons, responsive | ✅ 100% | 3 sprints completados |

### 🟡 PARCIALMENTE ALINEADO (80-95%)

| Sección Blueprint | Requerimiento | Estado Audit | GAP | Acción |
|---|---|---|---|---|
| **13. Feature Flags** | Activatable capabilities per org/env | ❌ 0% | No existe | Implementar en Fase 1 (8h) |
| **14. Onboarding 9-step** | Country → modules → integrations | ❌ 0% | No existe | Implementar en Fase 2 (10h) |
| **15. Dashboards Configurables** | 7 templates prebuilt (A-G) | 🟡 40% | Existe básico, falta builder | Ampliar en Fase 2 (12h) |
| **16. Contact Normalization** | UUID key, E.164 phone, dedup | 🟡 75% | Email/phone dedup OK, falta UUID | Refactor en Fase 1 (5h) |
| **17. Geolocalización IP** | IP capture + resolver location | 🟡 60% | IP capturada, falta geoloc | Agregar en Fase 1 (4h) |
| **18. Integración Google Ads** | GA4 + GTM + Ads conversions | ❌ 0% | No existe | Roadmap Fase 2 (15h) |
| **19. Integración Centro** | Centralized status/config panel | ❌ 0% | No existe | Implementar en Fase 1 (6h) |

### ❌ NO ALINEADO (0% - Critical Gaps)

| Sección Blueprint | Requerimiento | GAP | Severidad | Acción Inmediata |
|---|---|---|---|---|
| **20. Rate Limiting** | Endpoints públicos protegidos | 0% → CRÍTICO | 🔴 ALTA | Fase 0 (4h) |
| **21. CSRF Protection** | Tokens en forms públicos | 0% → CRÍTICO | 🔴 MEDIA | Fase 0 (3h) |
| **22. Testing Coverage** | Unit + integration + E2E | <10% → CRÍTICO | 🔴 ALTA | Fase 0 (58h) |
| **23. Monitoring/Observability** | Structured logging + dashboards | 0% → CRÍTICO | 🔴 ALTA | Fase 0 (5h) |
| **24. Documentación API** | OpenAPI/Swagger + guide | <5% → CRÍTICO | 🟠 MEDIA | Fase 0 (4h) |
| **25. Audit Logging** | Completar logs en endpoints críticos | 60% → CRÍTICO | 🟠 MEDIA | Fase 0 (4h) |

---

## PARTE 2: HALLAZGOS CRÍTICOS (Audit + Blueprint)

### 🔴 BLOQUEADORES PARA PRODUCCIÓN (Fase 0 - URGENTE)

#### 1. Rate Limiting Ausente (4h)
**Riesgo:** Spam, DoS, abuso en endpoints públicos  
**Endpoints afectados:**
- `POST /public/reservations/{slug}` - crear reserva
- `POST /public/reservations/{slug}/events` - tracking

**Solución:**
```typescript
// src/core/rate-limiting/rate-limit.decorator.ts
@RateLimit({ points: 10, duration: 60 }) // 10 requests/min
async createReservation(@Param('slug') slug: string) { ... }
```

**Dependencias:** Redis o memory-store  
**Commits:** 1  
**Tests:** 2 unit tests

---

#### 2. Testing Coverage <10% (58h - CRÍTICO)
**Riesgo:** Bugs desapercibidos, refactoring arriesgado

**Cobertura necesaria:**
| Componente | Tests | Horas |
|---|---|---|
| ReservationsService (30+ tests) | Unit | 16h |
| MetaConversionOutboxService (10+ tests) | Unit | 8h |
| LeadIntakeService (15+ tests) | Unit | 10h |
| PublicReservationPage (8+ tests) | Component | 12h |
| E2E (full flow) | Integration | 12h |

**Commits:** 3 (backend tests, frontend tests, E2E)

---

#### 3. Monitoring Ausente (5h)
**Riesgo:** Issues en producción sin visibilidad

**Necesario:**
- Structured logging (Winston/Pino)
- Alertas para errores críticos
- Dashboard de health
- SLA tracking

**Commits:** 2 (logging setup, dashboard)

---

#### 4. CSRF Protection (3h)
**Riesgo:** Cross-site request forgery en endpoints públicos

**Solución:**
```typescript
// Agregar CSRF headers en responses públicas
@Post('public/reservations/:slug')
@UseGuards(CsrfGuard)
async create(...) { ... }
```

**Commits:** 1

---

#### 5. Documentación API (4h)
**Riesgo:** Integración confusa, endpoints no claros

**Generar OpenAPI/Swagger desde decoradores NestJS**

**Commits:** 1

---

### 🟠 PROBLEMAS SECUNDARIOS (Fase 1 - Important)

| Problema | Impacto | Horas | Fase |
|---|---|---|---|
| Error handling en notificaciones | Emails fallan silenciosamente | 2h | 0 |
| Falta HSTS headers | Security gap menor | 2h | 0 |
| Slots endpoint performance (O(n*m)) | Lento con muchas reservas | 6h | 1 |
| Lead scoring sincrónico | Bloquea creación de reserva | 3h | 1 |
| ReservationsService (720 líneas) | Refactoring técnico | 4h | 1 |
| Full-text search | Búsqueda lenta con LIKE | 8h | 2 |

---

## PARTE 3: PLAN DE FASES (Timeline Ajustado)

### 📍 FASE 0: ESTABILIZACIÓN (97h - 6 semanas)

**Objetivo:** Preparar para GA (General Availability)  
**Prerequisitos:** Todo debe estar 100% antes de ir a producción

#### Semana 1-2: Security Hardening (13h)
```
[ ] Rate limiting en endpoints públicos (4h)
[ ] CSRF protection (3h)
[ ] HTTPS/HSTS headers (2h)
[ ] Audit logging completo (4h)
```
**Commits:** 4

#### Semana 2-3: Testing Foundation (40h)
```
[ ] Unit tests ReservationsService (16h)
[ ] Integration tests Meta CAPI (8h)
[ ] Component tests frontend (12h)
[ ] E2E tests (Cypress) (4h)
```
**Commits:** 4

#### Semana 3-4: Performance & Ops (13h)
```
[ ] Redis caching para slots (6h)
[ ] Query optimization + índices (4h)
[ ] Async lead scoring (3h)
```
**Commits:** 3

#### Semana 5: Monitoring & Ops (16h)
```
[ ] Structured logging (Winston/Pino) (5h)
[ ] Monitoring setup (Datadog/New Relic) (5h)
[ ] Alerting rules (3h)
[ ] Deployment automation (3h)
```
**Commits:** 2

#### Semana 6: Bugs & Docs (15h)
```
[ ] Bug fixes (drag & drop, email notification) (6h)
[ ] OpenAPI/Swagger (4h)
[ ] Deployment guide (3h)
[ ] Troubleshooting (2h)
```
**Commits:** 3

**Total Fase 0:** 97 horas (3 dev backend + 1 QA + 1 DevOps)

---

### 📍 FASE 1: PRODUCCIÓN-READY (74h - 4-5 semanas)

**Objetivo:** Optimizar para escala 10-100 clientes

#### Database & Infrastructure (10h)
```
[ ] TypeORM migrations framework (4h)
[ ] Backup automation (2h)
[ ] Replication setup (4h)
```

#### API Quality (12h)
```
[ ] API versioning (v1/v2) (3h)
[ ] Deprecation policy (1h)
[ ] API docs completar (6h)
[ ] Changelog automation (2h)
```

#### Code Quality (15h)
```
[ ] Refactor ReservationsService → 3 services (8h)
[ ] Extract validators (4h)
[ ] Dependency injection improvements (3h)
```

#### Observability (19h)
```
[ ] Structured logging everywhere (5h)
[ ] Distributed tracing (4h)
[ ] Prometheus metrics (4h)
[ ] Grafana dashboards (6h)
```

#### User Experience (11h)
```
[ ] WCAG 2.1 accessibility audit (4h)
[ ] Mobile responsiveness QA (3h)
[ ] Performance profiling (4h)
```

#### Support & SLA (7h)
```
[ ] SLA monitoring (2h)
[ ] Support playbook (3h)
[ ] Incident response (2h)
```

**Total Fase 1:** 74 horas (2 dev backend + 1 frontend + 1 DevOps)

---

### 📍 FASE 2: MULTI-CLIENTE SCALE (128h - 8 semanas)

**Objetivo:** Soportar 100+ clientes, dashboards avanzados, integraciones

#### Feature Flags System (8h)
```
[ ] Feature flag service implementation
[ ] Admin UI para toggle per org/client/role/env
[ ] Documentation
```

#### Onboarding Flow (10h)
```
[ ] 9-step wizard (country → modules → setup)
[ ] Module selector UI
[ ] Integration configuration
```

#### Dashboards Avanzados (12h)
```
[ ] Dashboard builder (widgets configurables)
[ ] 7 templates prebuilt (A-G por persona)
[ ] Custom charts (conversiones, cohort analysis)
```

#### Bulk Operations (19h)
```
[ ] Importar reservas masivas (CSV) (8h)
[ ] Bulk edit disponibilidad (6h)
[ ] Bulk export/reporting (5h)
```

#### Integraciones (21h)
```
[ ] Zapier/Make connector (6h)
[ ] Webhooks extensibles (5h)
[ ] Slack notifications (4h)
[ ] SMS gateway (Twilio) (6h)
```

#### Analytics Avanzada (34h)
```
[ ] Conversiones dashboard (12h)
[ ] Cohort analysis (8h)
[ ] Predictive capacity planning (10h)
[ ] Revenue tracking (4h)
```

#### Google Ads & GA4 (15h)
```
[ ] GA4 event tracking (6h)
[ ] Google Ads conversion import (5h)
[ ] GTM configuration (4h)
```

#### Scaling Infrastructure (24h)
```
[ ] Database read replicas (4h)
[ ] Microservices separation (12h)
[ ] Queue-based processing (8h)
```

**Total Fase 2:** 128 horas (3 dev backend + 2 frontend + 1 DevOps)

---

## PARTE 4: BACKLOG PRIORIZADO (Próximas 30 días)

### 🔴 CRÍTICO (hacer ya - Semana 1-2)

1. **Rate Limiting Endpoints Públicos** (4h)
   - Archivo: `src/core/rate-limiting/rate-limit.decorator.ts`
   - Tests: 2 unit tests
   - Commits: 1
   - Prioridad: MÁXIMA (protege contra DOS/spam)

2. **Testing Infrastructure Setup** (16h)
   - Jest + React Testing Library configurados
   - Fixtures de datos
   - Mock services
   - Commits: 3

3. **Structured Logging** (5h)
   - Winston/Pino setup
   - Correlation IDs en requests
   - Commits: 1

4. **CSRF Protection** (3h)
   - CSRF middleware
   - Headers en respuestas públicas
   - Commits: 1

5. **OpenAPI/Swagger** (4h)
   - Generar desde decoradores NestJS
   - Deploy en `/api/docs`
   - Commits: 1

### 🟠 ALTO (Semana 2-3)

6. **Slots Endpoint Optimization** (6h)
   - Redis caching
   - Query optimization
   - Commits: 1

7. **Email Notification Retry** (2h)
   - Queue system para emails
   - Exponential backoff
   - Commits: 1

8. **Unit Tests ReservationsService** (16h)
   - 30+ tests
   - Coverage >80%
   - Commits: 2

9. **Integration Tests Meta CAPI** (8h)
   - Test event flow completo
   - Mock Meta API
   - Commits: 1

### 🟡 MEDIO (Semana 3-4)

10. **Monitoring Setup** (5h)
    - Dashboard básico
    - Alertas críticas
    - Commits: 1

11. **Async Lead Scoring** (3h)
    - Move a background job
    - Bull queue
    - Commits: 1

12. **Frontend Component Tests** (12h)
    - PublicReservationPage
    - ReservationsPage
    - Forms
    - Commits: 2

---

## PARTE 5: MATRIZ DE DEPENDENCIAS

```
Rate Limiting (4h)
  ├─ Logging (5h)
  └─ Tests (58h total)
       ├─ Unit (40h)
       │   ├─ ReservationsService (16h)
       │   ├─ MetaConversions (8h)
       │   └─ LeadIntake (10h)
       └─ E2E (12h)
            └─ Monitoring (5h)

Optimization (6h)
  └─ Tests (para validar)

CSRF (3h)
  └─ Tests (1h específico)

Refactoring (4h)
  ├─ Tests existentes deben pasar
  └─ Tests nuevos (coverage)
```

---

## PARTE 6: ESTIMACIÓN TOTAL & TIMELINE

### Por Fase

| Fase | Horas | Semanas | FTE | Prioridad |
|---|---|---|---|---|
| **Fase 0** | 97h | 6 | 2-3 dev | 🔴 CRÍTICA |
| **Fase 1** | 74h | 4-5 | 2 dev | 🟠 ALTA |
| **Fase 2** | 128h | 8 | 3 dev | 🟡 MEDIA |
| **Fase 3** | ∞ | ∞ | ∞ | 🟢 ROADMAP |

### Timeline Ejecutable

```
HOY (2026-07-24)  → Inicio Fase 0
2026-09-04        → Fin Fase 0 (GA-ready)
2026-10-09        → Fin Fase 1 (Production-ready)
2026-12-04        → Fin Fase 2 (100+ clientes)
2027+             → Fase 3 (Mobile, AI, etc.)
```

---

## PARTE 7: CRITERIOS DE ÉXITO

### Fase 0 Completion Checklist

- [ ] Rate limiting activo en endpoints públicos
- [ ] 58+ horas de tests ejecutados (coverage >50%)
- [ ] Monitoring dashboard activo
- [ ] 0 bugs críticos conocidos
- [ ] OpenAPI/Swagger publicado
- [ ] Audit logging completo
- [ ] Load testing: 1000 reservas/min OK
- [ ] Security audit: 0 findings críticos

### Fase 1 Completion Checklist

- [ ] API versioning (v1) documentado
- [ ] Refactoring sin breaking changes
- [ ] Replication DB activa
- [ ] Observability: SLO defined y tracking
- [ ] WCAG 2.1 AA compliance

### Fase 2 Completion Checklist

- [ ] Feature flags en producción
- [ ] Onboarding wizard funcional
- [ ] Dashboard builder activo
- [ ] Integración Google Ads OK
- [ ] Soporta 100+ clientes sin degradación

---

## PARTE 8: RIESGOS & MITIGACIÓN

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|--------|-----------|
| Tests + Monitoring retrasados | ALTA | ALTO | Iniciar Semana 1 en paralelo |
| Rate limiting breaking public flow | MEDIA | MEDIO | Testing exhaustivo antes |
| Performance regression en tests | BAJA | MEDIO | Benchmark baseline primero |
| Feature flags overcomplicate code | MEDIA | MEDIO | Mantener simple (Fase 1-2) |
| Scope creep en onboarding | ALTA | MEDIO | MVP mode (9 steps solo) |

---

## PARTE 9: ARQUITECTURA DE REFERENCIA (Blueprint Sections)

### Resumen de Secciones Blueprint (25)

```
1. Página Pública Reserva ✅
2. Config Disponibilidad ✅
3. Bloqueos ✅
4. Bandeja Reservas ✅
5. CRM Contactos 🟡
6. Meta CAPI Schedule ✅
7. Meta CAPI Asistencia ✅
8. Validación Capacidad ✅
9. Multi-tenant ✅
10. Permisos 🟡
11. Google Calendar ✅
12. UI/UX Premium ✅
13. Feature Flags ❌ (Fase 1)
14. Onboarding 9-step ❌ (Fase 2)
15. Dashboards Configurables 🟡 (Fase 2)
16. Contact Normalization 🟡 (Fase 1)
17. Geolocalización IP 🟡 (Fase 1)
18. Google Ads Integration ❌ (Fase 2)
19. Integración Centro ❌ (Fase 1)
20. Rate Limiting 🔴 (Fase 0)
21. CSRF Protection 🔴 (Fase 0)
22. Testing Coverage 🔴 (Fase 0)
23. Monitoring ❌ (Fase 0)
24. Documentación API ❌ (Fase 0)
25. Audit Logging 🟡 (Fase 0)
```

---

## PARTE 10: PRÓXIMOS PASOS INMEDIATOS

### Mañana (2026-07-25)

1. ✅ **Revisar & Validar este documento** (user approval)
2. ✅ **Crear tasks en backlog** (TaskCreate x 15)
3. 🚀 **Iniciar Fase 0 Sprint 1:**
   - Rate limiting (4h)
   - Logging setup (5h)
   - Testing infrastructure (8h)

### Esta Semana

- [ ] Entregar commits de rate limiting + logging
- [ ] Entregar tests básicos
- [ ] Deploy en staging
- [ ] Load testing

### Próximas 2 Semanas

- [ ] Completar 40h de tests
- [ ] Completar CSRF + OpenAPI
- [ ] Monitoring dashboard activo
- [ ] Ready para GA review

---

**ESTADO:** 🟢 Listo para ejecutar  
**RESPONSABLE:** Dev team (2-3 FTE)  
**VALIDACIÓN:** Requerida del usuario  
**SIGUIENTE:** Crear tasks en backlog y comenzar Fase 0 Semana 1
