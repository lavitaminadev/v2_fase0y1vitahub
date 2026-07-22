# Gap Analysis: Documento Maestro vs. VITAHUB Actual

**Fecha:** 2026-07-15
**Propósito:** Mapear cada requerimiento del Documento Maestro de Operaciones de La Vitamina contra el código existente en VITAHUB, identificar brechas y priorizar.

---

## Resumen Ejecutivo

| Dimensión | Estado |
|-----------|--------|
| **Módulos backend existentes** | 22 feature + 3 integración + 11 core = ~65% del Maestro |
| **Módulos frontend existentes** | 12 páginas de ~22 requeridas = ~55% |
| **Portal del cliente** | ❌ No existe (0%) |
| **DTOs con validación** | ❌ Solo auth tiene (5%) |
| **Paginación** | ❌ 0 módulos implementan paginación |
| **Roles/Permisos** | ⚠️ RolesGuard existe pero `@Roles()` nunca se usa |
| **Eventos** | ⚠️ Solo production + crm emiten eventos (3 handlers) |
| **Pruebas** | ⚠️ 12 archivos, 74 tests — cubren ~30% de módulos |
| **Pipeline comercial completo** | ⚠️ Solo leads (sin contacts, opportunities, pipeline stages) |
| **Producción audiovisual** | ❌ Módulo no implementado |
| **Facturación + cobranza** | ❌ Solo GET invoices |
| **Reportería de resultados (Meta/Google)** | ⚠️ Backend con SQL raw, frontend básico |
| **Gamificación XP** | ✅ Bien implementado (calculator + use case + service + ranking) |
| **Presupuesto UD** | ✅ Bien implementado (service + use case + cron) |
| **Notificaciones y alertas** | ⚠️ Entidad + servicio existen, motor transversal incompleto |
| **Grilla/Calendario** | ⚠️ Backend parcial, frontend básico |
| **Documentación** | ⚠️ Existe estructura pero muchos módulos sin README |

---

## 1. Mapeo Módulo por Módulo

### 1.1 CRM / Pipeline Comercial (Maestro §5.1)

**Requerido:** Prospectos → Contactado → Reunión → Presupuesto → Negociación → Ganado/Perdido. Origen del lead, agendar reunión, generar presupuesto desde catálogo, versionar presupuestos, disparar onboarding al ganar.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad Lead | ✅ Existe | Sin relaciones a Contact/Company |
| Pipeline visual Kanban frontend | ✅ LeadsPage.tsx | Solo 5 estados básicos |
| Crear lead | ❌ | No hay POST endpoint ni form |
| Convertir lead → cliente | ❌ | No hay endpoint de conversión |
| Agendar reunión desde lead | ❌ | No existe |
| Generar presupuesto desde catálogo | ❌ | No existe |
| Historial de interacciones | ❌ | Directorio crm/interactions/ vacío |
| Oportunidades | ❌ | Directorio crm/opportunities/ vacío |
| Companies/Contactos | ❌ | Directorios vacíos |
| Evento lead.converted | ✅ Existe | Handler也在 core/events |

**Completitud: ~30%**

---

### 1.2 Catálogo de Servicios (Maestro §4.2)

**Requerido:** Servicios vendibles con precio y parámetros. Planes Esencial (20 UD, 2 reels) e Integral (32 UD, 6 reels). Meta Ads, Google Ads, plan gastronómico.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad Service | ✅ Existe | Solo GET /catalog/services |
| Entidad Quote | ✅ Existe | Sin endpoints |
| Planes con precio | ❌ | No modelados |
| Generar presupuesto comercial | ❌ | No existe |
| Catálogo frontend | ❌ | No hay página |

**Completitud: ~15%**

---

### 1.3 Onboarding y Briefs (Maestro §5.2)

**Requerido:** Cliente ganado → Brief → Grupo WA → CM asignada → Estrategia → Aprobación → Traspaso → Presentación → Grilla mes 1 → Operación activa.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad Onboarding | ✅ Existe | CRUD completo, service layer |
| Entidad Brief | ✅ Existe | CRUD completo, service layer |
| Checklist de onboarding | ❌ | No implementado |
| Flujo de estados onboarding | ❌ | No hay máquina de estados |
| Brief estructurado (campos) | ❌ | El Maestro dice [DEFINIR] |
| Frontend onboarding | ❌ | No hay página |
| Frontend briefs | ❌ | No hay página |

**Completitud: ~40%**

---

### 1.4 Gestión de Producción / Tablero (Maestro §5.4)

**Requerido:** Backlog → Asignado → En progreso → Revisión interna → Validación cliente → Corrección (máx 3) → Aprobado → Entregado. Niveles N1-N5, consumo UD, XP, nomenclatura, alerta 48h.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad Piece | ✅ Existe | Con niveles, UD, estados |
| Entidad PieceVersion | ✅ Existe | Versionado |
| Entidad Correction | ✅ Existe | Con origen (cliente/diseñador) |
| WorkflowService | ✅ Existe | assign, submitVersion, rejectByClient, deliver, flagDesignerError |
| Eventos piece.assigned/delivered/rejected | ✅ Existen | 3 event handlers |
| Naming validator | ✅ Existe | Valida nomenclatura |
| Alerta 48h sin movimiento | ✅ Cron job existe | stale-pieces.job |
| Frontend production | ✅ ProductionPage.tsx | Solo list + assign |
| Crear pieza (POST) | ❌ | No hay endpoint |
| Subir versiones desde frontend | ❌ | No implementado |
| Flujo completo de entregas | ❌ | Faltan endpoints reject/deliver en controller |
| Validación del cliente en portal | ❌ | No existe portal |
| Vista Kanban (Trello-like) | ❌ | Solo tabla |

**Completitud: ~60%**

---

### 1.5 Presupuesto de Diseño (UD) (Maestro §6.1)

**Requerido:** Matriz de consumo UD por tipo de pieza. Tracking saldo mensual por cliente. Planes Esencial ~20 UD, Integral ~32 UD. Regla: no acumulable, reels reemplazan posts.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad UDBudget | ✅ Existe | Por cliente, contracted/reserved/consumed |
| Entidad UDMovement | ✅ Existe | Trazabilidad |
| UD Calculator | ✅ Existe | calculateForPiece, reserve, confirmConsumption |
| Cron monthly budget cycles | ✅ Existe | Cron job |
| Frontend UD | ⚠️ Parcial | Solo en DashboardPage como cards |
| Vista detalle UD por cliente | ❌ | No existe |
| Regla "no acumulable" | ❌ | No codificada |
| Matriz completa de consumos | ⚠️ Parcial | design-budget.service.ts la tiene |

**Completitud: ~70%**

---

### 1.6 Producción Audiovisual (Maestro §5.5)

**Requerido:** CM crea moodboard → DC verifica → Director AV revisa → Sesión grabación/foto → Edición → Entrega. Niveles de dificultad AV [DEFINIR], tiempos, puntaje.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Módulo audiovisual | ❌ | Eliminado en migración (vacío) |
| Entidad Moodboard | ❌ | No existe |
| Entidad Sesión | ❌ | No existe |
| Flujo AV | ❌ | No implementado |
| Niveles AV | ❌ | [DEFINIR] en Maestro, propuesta entregada |

**Completitud: 0%**

---

### 1.7 Grilla / Calendario de Contenido (Maestro §5.3)

**Requerido:** Planificación mensual por cuenta. Piezas planificadas con fecha, tipo, estado. CM planifica → DC revisa → Producción → Publicación.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad ContentGrid | ✅ Existe | Por cliente + mes |
| Entidad ContentItem | ✅ Existe | scheduledDate, type, status |
| Use cases content | ✅ Existen | create-grid, add-item |
| Frontend ContentGrid | ✅ ContentGridPage.tsx | Solo vista, sin CRUD items |
| Vista calendario mensual | ❌ | Solo cards agrupadas |
| Arrastrar/soltar fechas | ❌ | No implementado |

**Completitud: ~45%**

---

### 1.8 Aprobaciones (Maestro §5.4 + §4.8)

**Requerido:** Flujo interno + validación del cliente en portal. Cliente aprueba/rechaza cada pieza. Máx 3 correcciones, la 4ª genera nota de cobro.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| Entidad ApprovalRequest | ✅ Existe | Con status, tipo |
| Controller approvals | ✅ Existe | GET + PUT approve/reject |
| Frontend Approvals | ✅ ApprovalsPage.tsx | List + approve/reject |
| Portal del cliente para validación | ❌ | No existe |
| Vista previa de pieza | ❌ | No implementada |
| Comentarios del cliente | ❌ | No implementados |
| Regla 3 correcciones | ⚠️ Existe en Piece.correctionCount | No vinculada a cobro |

**Completitud: ~40%**

---

### 1.9 Gamificación / XP (Maestro §6.2)

**Requerido:** XP semanal por nivel (N1=5 ... N5=80), bonos por velocidad, naming perfecto, penalizaciones por atraso/error. Rangos Bronce-Diamante. Leaderboard. Bono económico mensual.

| Aspecto | Estado | Brecha |
|---------|--------|--------|
| XP Calculator | ✅ Excelente | Cálculo completo con bonos/penalizaciones |
| XPEvent | ✅ Existe | Trazabilidad por evento |
| XPPeriod | ✅ Existe | Semanal por usuario |
| RegisterXpUseCase | ✅ Existe | Con transacciones |
| XPService | ✅ Refactorizado | Delega a RegisterXpUseCase |
| GetWeeklyRankingUseCase | ✅ Existe | Ranking semanal |
| Cron close-xp-periods | ✅ Existe | Cierre semanal |
| XP Tier thresholds | ✅ Existe | Bronce-Platino-Diamante |
| Frontend leaderboard | ❌ | No existe página |
| Frontend XP individual | ❌ | No existe vista |

**Completitud: ~85%** (backend sólido, frontend ausente)

---

### 1.10 Reuniones y Actas (Maestro §5.6 + §4.10)

**Requerido:** Reunión estratégica mensual + seguimiento semanal. Acta desde plantilla, acceso del cliente vía portal. [DEFINIR] estructura obligatoria de la reunión.

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Entidad Meeting | ✅ Existe | Con tipo, fecha, notas |
| Entidad ActionItem | ✅ Existe | Sin endpoints |
| Use cases meetings | ✅ Existen | create-meeting |
| Frontend Meetings | ✅ MeetingsPage.tsx | List + create |
| Plantilla de acta | ❌ | No implementada |
| Acceso del cliente | ❌ | No existe portal |
| Acción de seguimiento | ❌ | ActionItem sin endpoints |

**Completitud: ~50%**

---

### 1.11 Reportería de Resultados (Maestro §4.11)

**Requerido:** Reporte mensual por cliente con métricas de venta generada. Integración Meta Ads, Google Ads, plataformas de reserva, CRM. El dato más importante del sistema.

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Endpoints reports | ✅ Existen | GET /reporting/reports, /kpi, /dashboard |
| Frontend reports | ✅ ReportsPage.tsx | Cards + charts |
| Frontend direction KPIs | ✅ DirectionPage.tsx | 7 KPIs estratégicos |
| Integración Meta Ads | ⚠️ Parcial | Meta module existe, insights use case planeado |
| Integración Google Ads | ❌ | No implementada |
| Plataformas de reserva | ❌ | [DEFINIR] en Maestro |
| Reporte mensual por cliente | ❌ | No implementado como entidad |
| Exportación PDF/CSV | ❌ | No implementada |

**Completitud: ~40%**

---

### 1.12 Portal del Cliente (Maestro §4.12)

**Requerido:** Acceso limitado: grilla, actas, reportes, validación de piezas. Reemplaza WhatsApp como canal de aprobación.

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Login para clientes | ❌ | No existe |
| Vista de grilla para cliente | ❌ | No existe |
| Validación de piezas | ❌ | No existe |
| Acta de reuniones | ❌ | No existe |
| Reporte de resultados | ❌ | No existe |
| Perfil de cliente | ❌ | No existe |

**Completitud: 0%**

---

### 1.13 Facturación y Pagos (Maestro §4.13)

**Requerido:** Cobros recurrentes, estados (emitida/pagada/vencida), correos automáticos de cobranza. Integración con proveedor de facturación [DEFINIR].

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Entidad Invoice | ✅ Existe | Con todos los campos |
| GET /billing/invoices | ✅ Existe | Solo list |
| POST/PUT/DELETE invoices | ❌ | No implementados |
| Cobranza automática | ❌ | No implementada |
| Integración SII/Bsale/Nubox | ❌ | [DEFINIR] |
| Frontend facturación | ❌ | No existe página |
| Correos automáticos mora | ❌ | No implementados |

**Completitud: ~15%**

---

### 1.14 Gestión Documental (Maestro §7)

**Requerido:** Integración Drive como repositorio. Validación automática de nomenclatura CLIENTE_TIPO-PIEZA_FORMATO_vVERSIÓN_ESTADO. Estructura de carpetas por cliente.

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Entidad Document | ✅ Existe | CRUD completo |
| Naming validator | ✅ Existe | En producción |
| Integración Drive | ⚠️ Parcial | Upload entity + syncToDrive TODO |
| Estructura carpetas Drive | ❌ | No implementada |
| Frontend documentos | ❌ | No existe página |
| Archivos inmutables (FINAL) | ❌ | No implementado |

**Completitud: ~40%**

---

### 1.15 Notificaciones y Alertas (Maestro §8)

**Requerido:** Motor transversal: pieza estancada >48h, deadline próximo, reunión sin agendar, UD cerca del límite, factura vencida, grilla no cargada, reporte pendiente.

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Entidad Notification | ✅ Existe | Con CRUD + servicio |
| Servicio notifyUser/notifyRole/notifyMultiple | ✅ Existe | NotificationsService |
| Alertas 48h piezas estancadas | ✅ Cron job existe | stale-pieces.job |
| Alertas budget cíclico | ✅ Cron job existe | monthly-budget-cycles.job |
| Notificaciones en tiempo real | ❌ | No hay WebSocket/SSE |
| Frontend campanita | ❌ | No existe UI de notificaciones |
| Alertas facturación | ❌ | No implementadas |
| Alertas grilla/reportes | ❌ | No implementadas |

**Completitud: ~40%**

---

### 1.16 Administración de Usuarios (Maestro §4.16)

**Requerido:** CRUD usuarios, roles, permisos por rol y por cuenta (CM ve solo sus cuentas, directores ven todo).

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Entidad User | ✅ Existe | Con role, isActive |
| Auth service | ✅ Existe | Login, register, refresh, profile |
| Roles decorator + RolesGuard | ✅ Existen | Pero `@Roles()` nunca se usa |
| CRUD usuarios backend | ⚠️ Parcial | Solo GET + POST |
| Frontend user management | ❌ | No existe página |
| Permisos por cuenta (CM scope) | ❌ | No implementado |
| Reset password | ❌ | No implementado |

**Completitud: ~40%**

---

### 1.17 Dashboards por Rol (Maestro §9)

**Requerido:** 
- Directivo: MRR, clientes activos/en riesgo, ocupación, capacidad, UD, rentabilidad, pagos
- Operaciones: estado cuentas, cumplimiento reuniones, piezas atrasadas, onboardings
- CM: sus cuentas, grillas, reuniones, validaciones pendientes
- Diseñador: tareas, deadlines, XP, ranking
- Cliente: grilla, actas, reportes, validaciones

| Aspecto | Estado | Brecha |
|--------|--------|--------|
| Dashboard directivo (Direction) | ✅ DirectionPage.tsx | 7 KPIs estratégicos |
| Dashboard operaciones | ✅ DashboardPage.tsx | 4 métricas + UD + producción |
| Dashboard CM | ❌ | No existe vista específica |
| Dashboard diseñador | ❌ | No existe vista XP/ranking |
| Dashboard cliente | ❌ | No existe portal |
| Filtros por rol | ❌ | Todos ven lo mismo |

**Completitud: ~35%**

---

## 2. Brechas Técnicas Transversales

| # | Brecha | Impacto | Prioridad |
|---|--------|---------|-----------|
| **T1** | **Sin DTOs con class-validator** (excepto auth) | Riesgo de datos inválidos en 24/25 módulos | 🔴 CRITICAL |
| **T2** | **Sin paginación en ningún endpoint** | Degradación con >100 registros | 🔴 CRITICAL |
| **T3** | **RolesGuard existe pero no se aplica** | Solo hay autenticación, no autorización fina | 🔴 CRITICAL |
| **T4** | **Portal del cliente no existe** | Funcionalidad core del Maestro ausente | 🔴 CRITICAL |
| **T5** | **Sin WebSocket/SSE para notificaciones** | Notificaciones solo en DB, no en tiempo real | 🟡 HIGH |
| **T6** | **Sin refresh token rotation en frontend** | Seguridad de sesión mejorable | 🟡 HIGH |
| **T7** | **Sin exportación (PDF/CSV)** | Reportería limitada | 🟡 HIGH |
| **T8** | **Patrones mixtos (Service vs UseCase vs @InjectRepository)** | Inconsistencia arquitectónica | 🟡 HIGH |
| **T9** | **Sin feature manifests frontend** | No se puede desactivar features | 🟢 MEDIUM |
| **T10** | **Sin navegación modular** | Nav en Layout.tsx, no por feature | 🟢 MEDIUM |

---

## 3. Resumen de Completitud por Módulo

```
CRM/Pipeline          ████████░░░░  30%
Catálogo              ███░░░░░░░░░  15%
Onboarding/Briefs     ████████░░░░  40%
Producción            ██████████░░  60%
UD Budget             ███████████░  70%
Audiovisual           ░░░░░░░░░░░░   0%
Grilla/Contenido      █████████░░░  45%
Aprobaciones          ████████░░░░  40%
Gamificación/XP       █████████████ 85%
Reuniones/Actas       █████████░░░  50%
Reportería            ████████░░░░  40%
Portal Cliente        ░░░░░░░░░░░░   0%
Facturación           ███░░░░░░░░░  15%
Gestión Documental    ████████░░░░  40%
Notificaciones        ████████░░░░  40%
Usuarios/Permisos     ████████░░░░  40%
Dashboards            ███████░░░░░  35%
────────────────────────────────────
PROMEDIO GENERAL:                    38%
```

---

## 4. Priorización Recomendada para Próximos Sprints

### Sprint 1 (CRITICAL — Arquitectura)
1. Agregar DTOs + class-validator a todos los controllers backend
2. Implementar paginación (skip/take) en endpoints list
3. Aplicar `@Roles()` decorator en controllers con RolesGuard
4. Agregar refresh token rotation en frontend

### Sprint 2 (CRITICAL — Portal Cliente)
5. Crear módulo frontend `features/client-portal/`
6. Login para clientes (rol = client)
7. Vista de grilla para cliente (read-only)
8. Validación de piezas (approve/reject)

### Sprint 3 (HIGH — Módulos Faltantes)
9. Completar CRM (convert lead, opportunities, interactions)
10. Frontend Gamification (leaderboard, XP individual)
11. Frontend Billing (invoices list + detail)
12. Frontend Documents (list + upload)

### Sprint 4 (HIGH — Features Core)
13. Completar Production (create piece, versions, reject, deliver en controller)
14. Completar Content Grid (CRUD items, drag-drop)
15. Completar Meetings (action items, attendees)
16. Completar Integrations (OAuth flow, Meta connect)

### Sprint 5 (MEDIUM — Reportería + Facturación)
17. Integración Meta Ads para reportería
18. Exportación PDF/CSV reportes
19. Facturación (emitir, pagar, cobranza)
20. WebSocket/SSE para notificaciones

### Sprint 6 (LOW — Restante)
21. Módulo Audiovisual (post-propuesta)
22. Catálogo comercial completo
23. Dashboard por rol
24. Feature manifests + navegación modular

---

## 5. Lo que SÍ está Bien (No Tocar)

- **Arquitectura modular** (core/ + modules/ + infrastructure/) ✅
- **Tenancy** (AsyncLocalStorage, middleware, guard, interceptor, subscriber) ✅
- **Auditoría** (entity + service, todas las mutations registradas) ✅
- **Gamificación** (calculator + use case + service + ranking + cron) ✅
- **UD Budget** (service + use case + cron) ✅
- **Production workflow** (assign, submit, deliver, reject con eventos) ✅
- **Auth** (JWT, refresh, roles decorator infra) ✅
- **PWA** (service worker, manifest, build) ✅
- **Error Boundary** + lazy loading + Suspense ✅ (recién agregado)
- **Naming validator** ✅
- **Health checks** ✅
