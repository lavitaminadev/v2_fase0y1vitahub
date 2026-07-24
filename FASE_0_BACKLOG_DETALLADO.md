> # ⛔ DOCUMENTO OBSOLETO — NO USAR
> Casi todas sus tareas ya están implementadas (rate limiting, CSRF/helmet, audit, tests, Swagger)
> o usan infraestructura no disponible en iHosting (Redis, Bull, K8s).
> **Ver [`BACKLOG_CORREGIDO.md`](BACKLOG_CORREGIDO.md).**

# FASE 0 — Backlog Detallado Listo para Ejecutar

**Fase:** 0 - Estabilización (GA-Ready)  
**Duración:** 6 semanas (97 horas)  
**Equipo:** 2-3 backend dev + 1 QA + 1 DevOps  
**Inicio:** 2026-07-25  
**Fin:** 2026-09-04  

---

## SEMANA 1-2: SECURITY HARDENING (13h)

### 1️⃣ TASK: Implementar Rate Limiting (4h)

**Objetivo:** Proteger endpoints públicos contra spam/DOS  
**Severidad:** 🔴 CRÍTICA  

**Subtasks:**

#### 1.1 Rate Limit Decorator (2h)
**Archivo nuevo:** `apps/api/src/core/rate-limiting/rate-limit.decorator.ts`

```typescript
import { applyDecorators } from '@nestjs/common';

export function RateLimit(options: {
  points: number;      // Requests allowed
  duration: number;    // Time window (segundos)
  skipSuccessfulRequests?: boolean;
}) {
  return applyDecorators(
    // Implementation usando redis-rate-limiter
  );
}

// Usage:
@Post('public/reservations/:slug')
@RateLimit({ points: 10, duration: 60 })
async create(...) { }
```

**Endpoints a proteger:**
- `POST /public/reservations/{slug}` (crear reserva) → 10/min per IP
- `POST /public/reservations/{slug}/events` (tracking) → 30/min per IP
- `GET /public/reservations/{slug}` (obtener form) → 100/min per IP
- `GET /public/reservations/{slug}/slots` (slots) → 50/min per IP
- `POST /public/reservations/{slug}/coupon-validate` → 20/min per IP

**Tests:** 2 unit tests
- Test: rate limit exceeded → 429 Too Many Requests
- Test: requests within limit → 200 OK

**Commits:** 1

---

#### 1.2 Rate Limiter Service (2h)
**Archivo nuevo:** `apps/api/src/core/rate-limiting/rate-limiter.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RateLimiterRes } from 'rate-limiter-flexible';

@Injectable()
export class RateLimiterService {
  async checkLimit(key: string, points: number): Promise<boolean> {
    // Implementation with Redis or memory store
  }
}
```

**Dependencies:**
```json
{
  "rate-limiter-flexible": "^2.4.1"
}
```

**Tests:** 2 unit tests
- Test: Redis connection OK
- Test: Rate limit storage/retrieval

**Commits:** 1 (combined with decorator)

---

### 2️⃣ TASK: CSRF Protection (3h)

**Objetivo:** Prevenir cross-site request forgery en endpoints públicos  
**Severidad:** 🟠 MEDIA

**Subtasks:**

#### 2.1 CSRF Middleware (1.5h)
**Archivo nuevo:** `apps/api/src/core/csrf/csrf.guard.ts`

```typescript
import { Injectable, CanActivate } from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Validar token CSRF en header
    const token = request.headers['x-csrf-token'];
    const sessionToken = request.session?.csrfToken;
    
    return token && token === sessionToken;
  }
}
```

**Endpoints:**
- Apply a: `POST /public/reservations/{slug}`
- Exclude GET (no state mutation)

**Tests:** 2 unit tests
- Test: CSRF token missing → 403 Forbidden
- Test: CSRF token invalid → 403 Forbidden
- Test: CSRF token valid → 200 OK

**Commits:** 1

---

#### 2.2 CSRF Token Response Headers (1.5h)
**Archivo modificar:** `apps/api/src/core/middlewares/csrf.middleware.ts`

```typescript
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generar token CSRF único
    const csrfToken = generateToken();
    res.setHeader('X-CSRF-Token', csrfToken);
    
    // Guardar en session
    req.session.csrfToken = csrfToken;
    next();
  }
}
```

**Apply a todo (global):**
```typescript
// app.module.ts
app.use(CsrfMiddleware);
```

**Tests:** Incluido en 2.1

**Commits:** 1 (combined with guard)

---

### 3️⃣ TASK: HTTPS & HSTS Headers (2h)

**Objetivo:** Forzar HTTPS y prevenir downgrade attacks  

**Subtasks:**

#### 3.1 HSTS Middleware (1h)
**Archivo modificar:** `apps/api/src/main.ts`

```typescript
app.use((req, res, next) => {
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  next();
});
```

**Verificación:**
- [ ] Encabezados presentes en respuestas HTTPS
- [ ] HTTP → HTTPS redirect activo

**Commits:** 1

---

#### 3.2 Nginx/Production Config (1h)
**Archivo modificar/crear:** `nginx.conf` (deployment)

```nginx
server {
  listen 443 ssl http2;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  
  add_header Strict-Transport-Security "max-age=31536000" always;
  
  # Redirect HTTP → HTTPS
  if ($scheme != "https") {
    return 301 https://$server_name$request_uri;
  }
}
```

**Tests:** Integration test (verificar headers)

**Commits:** 1 (combined with middleware)

---

### 4️⃣ TASK: Audit Logging Completo (4h)

**Objetivo:** Registrar cambios en operaciones críticas (creación, update, delete)

**Subtasks:**

#### 4.1 Audit Logger Service (2h)
**Archivo nuevo:** `apps/api/src/core/audit/audit-logger.service.ts`

```typescript
@Injectable()
export class AuditLoggerService {
  async log(event: AuditEvent) {
    const entry = {
      timestamp: new Date(),
      userId: event.userId,
      action: event.action, // CREATE, UPDATE, DELETE, etc.
      resourceType: event.resourceType, // Reservation, Client, etc.
      resourceId: event.resourceId,
      oldValue: event.oldValue,
      newValue: event.newValue,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    };
    
    await this.auditRepository.save(entry);
  }
}
```

**Eventos a auditar:**
- `ReservationCreated` → log action=CREATE
- `ReservationUpdated` → log action=UPDATE, diff
- `ReservationDeleted` → log action=DELETE
- `ClientLogoUpdated` → log action=UPDATE
- `FormConfigChanged` → log action=UPDATE
- `CouponCreated` → log action=CREATE
- `PasswordChanged` → log action=UPDATE (sin guardar password)

**Database:** New table `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

**Tests:** 3 unit tests
- Test: Log CREATE event
- Test: Log UPDATE event con diff
- Test: Log DELETE event

**Commits:** 1

---

#### 4.2 Audit Logger Integration (2h)
**Archivo modificar:** `apps/api/src/modules/reservations/reservations.service.ts`

```typescript
async createReservation(input) {
  const reservation = await this.create(input);
  
  // Log event
  await this.auditLogger.log({
    userId: input.userId,
    action: 'CREATE',
    resourceType: 'Reservation',
    resourceId: reservation.id,
    newValue: reservation,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  
  return reservation;
}
```

**Apply similar a:**
- `updateReservation()` → UPDATE
- `deleteReservation()` → DELETE
- `updateForm()` → UPDATE
- `updateClient()` → UPDATE (logo)
- `changePassword()` → UPDATE

**Tests:** 2 integration tests
- Test: Audit log created después de Create
- Test: Audit log shows diff en Update

**Commits:** 1 (combined with service)

---

---

## SEMANA 2-3: TESTING FOUNDATION (40h)

### 5️⃣ TASK: Jest Setup & Infrastructure (8h)

**Objetivo:** Configurar testing framework con mocks y fixtures

**Subtasks:**

#### 5.1 Jest Configuration (2h)
**Archivo nuevo:** `apps/api/jest.config.js`

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

**Dependencies:**
```json
{
  "jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "@types/jest": "^29.0.0"
}
```

**Commits:** 1

---

#### 5.2 Mock Services & Fixtures (3h)
**Archivo nuevo:** `apps/api/src/__tests__/mocks/`

```
__tests__/
├── fixtures/
│   ├── users.fixture.ts
│   ├── organizations.fixture.ts
│   ├── reservations.fixture.ts
│   └── forms.fixture.ts
├── mocks/
│   ├── meta-conversions.mock.ts
│   ├── cloudinary.mock.ts
│   ├── google-calendar.mock.ts
│   └── email.mock.ts
└── helpers/
    ├── db.helper.ts (setup/teardown test DB)
    └── auth.helper.ts (generate test JWT)
```

**Ejemplo fixture:**
```typescript
// fixtures/reservations.fixture.ts
export const createTestReservation = (override = {}) => ({
  id: 'res-' + randomUUID(),
  formId: 'form-001',
  name: 'Test User',
  email: 'test@example.com',
  phone: '+56912345678',
  status: 'pending',
  ...override,
});
```

**Commits:** 1

---

#### 5.3 Test Database Setup (3h)
**Archivo nuevo:** `apps/api/src/__tests__/setup.ts`

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';

export async function setupTestDB() {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [/* all entities */],
        synchronize: true,
      }),
    ],
  }).compile();
  
  return module;
}

export async function teardownTestDB(module) {
  const dataSource = module.get(DataSource);
  await dataSource.destroy();
}
```

**Commits:** 1 (combined with fixtures)

---

### 6️⃣ TASK: ReservationsService Unit Tests (16h)

**Objetivo:** Cobertura completa de lógica crítica (30+ tests)

**Archivo:** `apps/api/src/modules/reservations/reservations.service.spec.ts`

**Tests a escribir:**

#### 6.1 createReservation() (8 tests, 4h)
```typescript
describe('ReservationsService.createReservation', () => {
  it('should create reservation with valid data', async () => { });
  it('should validate daily capacity', async () => { });
  it('should validate time slot availability', async () => { });
  it('should calculate correct fee from coupon', async () => { });
  it('should normalize phone number to E.164', async () => { });
  it('should fail if form is disabled', async () => { });
  it('should enqueue Meta CAPI event', async () => { });
  it('should trigger LeadIntakeService', async () => { });
});
```

**Expected assertions:**
- Reserva creada con ID único
- Status = pending
- Capacidad decrementada
- Meta event enqueued
- Lead captured

**Commits:** 1

---

#### 6.2 updateReservation() (6 tests, 3h)
```typescript
describe('ReservationsService.updateReservation', () => {
  it('should update status to confirmed', async () => { });
  it('should update status to attended', async () => { });
  it('should send Meta Reserva_Asistida event on attended', async () => { });
  it('should update lead status on status change', async () => { });
  it('should not allow invalid status transitions', async () => { });
  it('should audit log the change', async () => { });
});
```

**Commits:** 1

---

#### 6.3 getAvailableSlots() (6 tests, 3h)
```typescript
describe('ReservationsService.getAvailableSlots', () => {
  it('should return slots for available dates', async () => { });
  it('should exclude blocked dates', async () => { });
  it('should respect capacity limits', async () => { });
  it('should apply buffer times correctly', async () => { });
  it('should handle timezone conversion', async () => { });
  it('should return empty if no availability', async () => { });
});
```

**Commits:** 1

---

#### 6.4 validateConfiguration() (5 tests, 2h)
```typescript
describe('ReservationsService.validateConfiguration', () => {
  it('should validate schedule config', async () => { });
  it('should validate timezone', async () => { });
  it('should detect overlapping windows', async () => { });
  it('should validate field schema', async () => { });
  it('should validate capacity > 0', async () => { });
});
```

**Commits:** 1 (combined)

---

#### 6.5 validateAvailability() (5 tests, 2h)
```typescript
describe('ReservationsService.validateAvailability', () => {
  it('should allow if slot available', async () => { });
  it('should reject if slot full', async () => { });
  it('should check both daily and slot capacity', async () => { });
  it('should consider buffer times', async () => { });
  it('should respect blocked dates', async () => { });
});
```

**Commits:** 1 (combined)

---

### 7️⃣ TASK: MetaConversionOutboxService Unit Tests (8h)

**Objetivo:** 10+ tests para retry logic y queue handling

**Archivo:** `apps/api/src/modules/meta/meta-conversion-outbox.service.spec.ts`

**Tests:**
```typescript
describe('MetaConversionOutboxService', () => {
  // Enqueue (3 tests)
  it('should enqueue event with pending status', async () => { });
  it('should prevent duplicate events (by eventId)', async () => { });
  it('should validate event structure', async () => { });
  
  // processPending (5 tests)
  it('should process pending events', async () => { });
  it('should retry on 429 (rate limit)', async () => { });
  it('should give up on 4xx (except 429)', async () => { });
  it('should detect token expiration', async () => { });
  it('should use exponential backoff (2^attempts)', async () => { });
  
  // Cleanup (2 tests)
  it('should cleanup processed events after 7 days', async () => { });
  it('should cleanup failed events after 7 days', async () => { });
});
```

**Commits:** 2

---

### 8️⃣ TASK: LeadIntakeService Unit Tests (10h)

**Objetivo:** 15+ tests para deduplication y scoring

**Archivo:** `apps/api/src/modules/crm/lead-intake.service.spec.ts`

**Tests:**
```typescript
describe('LeadIntakeService', () => {
  // Deduplication (5 tests)
  it('should find existing lead by email', async () => { });
  it('should find existing lead by phone', async () => { });
  it('should create new lead if no match', async () => { });
  it('should prefer exact match over partial', async () => { });
  it('should handle multiple matches (dedupe)', async () => { });
  
  // Scoring (5 tests)
  it('should score lead as QUALIFIED', async () => { });
  it('should score lead as REVIEW', async () => { });
  it('should score lead as DISCARDED (spam)', async () => { });
  it('should apply quality bonuses (company, etc)', async () => { });
  it('should detect spam keywords', async () => { });
  
  // Status Updates (5 tests)
  it('should update status on reservation', async () => { });
  it('should update status on attendance', async () => { });
  it('should handle multiple contact matches', async () => { });
  it('should log interactions', async () => { });
  it('should sync with CRM automation', async () => { });
});
```

**Commits:** 2

---

### 9️⃣ TASK: Frontend Component Tests (12h)

**Objetivo:** 8+ tests para componentes críticos

**Archivo:** `apps/web/src/__tests__/` (new directory)

#### Component Tests:
```
PublicReservationPage.spec.tsx (3 tests, 4h)
  - Render form with all fields
  - Submit reservation → API call
  - Show error on validation fail

ReservationsPage.spec.tsx (2 tests, 3h)
  - Load and display reservations list
  - Change status → update visible

FormBuilderPage.spec.tsx (2 tests, 3h)
  - Drag-drop fields (dnd-kit)
  - Save configuration

ExportModal.spec.tsx (1 test, 2h)
  - Export CSV/JSON with selected fields
```

**Dependencies:**
```json
{
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.0.0"
}
```

**Commits:** 2

---

### 🔟 TASK: E2E Tests (12h)

**Objetivo:** Full flow testing (3 scenarios)

**Archivo:** `e2e/tests/`

#### Scenario 1: Create & Attend Reservation (6h)
```gherkin
Scenario: User creates reservation and marks attended
  Given I visit the public reservation page
  When I select a date and time
  And I fill in my details
  And I submit the form
  Then a reservation is created
  And Meta Schedule event is enqueued
  
  When I mark the reservation as attended
  Then Meta Reserva_Asistida event is sent
  And lead status is updated to "attended"
```

#### Scenario 2: Capacity Enforcement (3h)
```gherkin
Scenario: Daily capacity is enforced
  Given a form with dailyCapacity=2
  When 2 reservations are created
  Then the day shows as full
  And new reservations are rejected
```

#### Scenario 3: Availability Blocking (3h)
```gherkin
Scenario: Blocked dates hide slots
  Given a form with availability configured
  When I block 2026-08-01
  Then that date is not selectable
```

**Tool:** Cypress or Playwright  
**Commits:** 1

---

---

## SEMANA 3-4: PERFORMANCE & OPS (13h)

### 1️⃣1️⃣ TASK: Redis Caching for Slots (6h)

**Objetivo:** Cachear resultados de getAvailableSlots() para evitar O(n*m)

**Subtasks:**

#### 11.1 Cache Service (2h)
**Archivo nuevo:** `apps/api/src/core/cache/cache.service.ts`

```typescript
@Injectable()
export class CacheService {
  async getSlots(formId: string, startDate: Date): Promise<Slot[]> {
    const key = `slots:${formId}:${startDate.toISOString().split('T')[0]}`;
    
    // Try cache
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    // Compute
    const slots = await this.reservationsService.computeSlots(formId, startDate);
    
    // Cache for 1 hour
    await this.redis.set(key, JSON.stringify(slots), 'EX', 3600);
    
    return slots;
  }
}
```

**Commits:** 1

---

#### 11.2 Invalidate on Change (2h)
**Archivo modificar:** `apps/api/src/modules/reservations/reservations.service.ts`

```typescript
async createReservation(input) {
  const reservation = await this.create(input);
  
  // Invalidate slots cache for that date
  const cacheKey = `slots:${reservation.formId}:${reservation.date}`;
  await this.cache.del(cacheKey);
  
  return reservation;
}
```

**Apply similar to:**
- `updateReservation()` (on date/time change)
- `updateAvailabilityBlock()` (block/unblock date)
- `updateForm()` (config change)

**Commits:** 1

---

#### 11.3 Redis Setup (2h)
**Archivo:** `apps/api/docker-compose.yml` (or cloud setup)

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

**Environment:**
```bash
REDIS_URL=redis://localhost:6379
```

**Commits:** 1 (combined)

---

### 1️⃣2️⃣ TASK: Query Optimization & Indexes (4h)

**Objetivo:** Agregar índices faltantes y optimizar queries lentas

**Subtasks:**

#### 12.1 Add Missing Indexes (2h)
**Archivo nuevo:** Migration TypeORM

```typescript
// Create indexes
CREATE INDEX idx_reservations_form_date 
  ON reservations(form_id, created_at DESC);

CREATE INDEX idx_reservations_status
  ON reservations(status);

CREATE INDEX idx_leads_organization
  ON leads(organization_id);

CREATE INDEX idx_leads_email_phone
  ON leads(email, phone);

CREATE INDEX idx_meta_outbox_status
  ON meta_conversion_outbox(status, created_at);
```

**Database migration:**
```typescript
export class AddOptimizationIndexes {
  public async up(queryRunner) {
    await queryRunner.query(`CREATE INDEX ...`);
  }
  
  public async down(queryRunner) {
    await queryRunner.query(`DROP INDEX ...`);
  }
}
```

**Commits:** 1

---

#### 12.2 Query Optimization (2h)
**Archivo modificar:** `reservations.service.ts`

```typescript
// BEFORE: N+1 query
const reservations = await repo.find({ formId });
for (const r of reservations) {
  r.lead = await leadRepo.findOne({ email: r.email }); // N queries!
}

// AFTER: Single JOIN
const reservations = await repo.find({
  where: { formId },
  relations: ['lead', 'form'],
});
```

**Apply to:**
- `getReservations()` → join lead
- `getMetrics()` → optimize GROUP BY
- `getSlots()` → optimize availability check

**Commits:** 1 (combined with indexes)

---

### 1️⃣3️⃣ TASK: Async Lead Scoring (3h)

**Objetivo:** Mover lead scoring a background job (no bloquea creación)

**Subtasks:**

#### 13.1 Bull Queue Setup (2h)
**Archivo nuevo:** `apps/api/src/core/queues/lead-scoring.queue.ts`

```typescript
import { Process, Processor } from '@nestjs/bull';

@Processor('lead-scoring')
export class LeadScoringQueue {
  @Process()
  async scoreLead(job: Job<{ leadId: string }>) {
    const lead = await this.leadService.findById(job.data.leadId);
    
    // Compute score asynchronously
    const score = await this.leadService.computeScore(lead);
    
    // Update lead
    await this.leadService.updateScore(lead.id, score);
  }
}
```

**Commits:** 1

---

#### 13.2 Async Job Dispatch (1h)
**Archivo modificar:** `lead-intake.service.ts`

```typescript
async captureLead(reservation: Reservation) {
  // Create lead with default score
  const lead = await this.leadRepository.save({
    email: reservation.email,
    phone: reservation.phone,
    qualityScore: 0, // Will be updated async
  });
  
  // Queue scoring job
  await this.leadScoringQueue.add({
    leadId: lead.id,
  });
  
  return lead;
}
```

**Commits:** 1 (combined)

---

---

## SEMANA 5: MONITORING & OPERATIONAL (16h)

### 1️⃣4️⃣ TASK: Structured Logging (5h)

**Objetivo:** Structured logging con Winston/Pino + correlation IDs

**Subtasks:**

#### 14.1 Winston Setup (2h)
**Archivo nuevo:** `apps/api/src/core/logging/logger.module.ts`

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'vitahub-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

**Log format (JSON):**
```json
{
  "timestamp": "2026-07-25T10:30:45Z",
  "level": "info",
  "message": "Reservation created",
  "service": "vitahub-api",
  "traceId": "abc123",
  "userId": "user-001",
  "reservationId": "res-001",
  "metadata": {
    "formId": "form-001",
    "status": "pending"
  }
}
```

**Commits:** 1

---

#### 14.2 Correlation ID Middleware (2h)
**Archivo nuevo:** `apps/api/src/core/logging/trace-id.middleware.ts`

```typescript
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const traceId = req.headers['x-trace-id'] || generateUUID();
    
    // Store in request context
    req['traceId'] = traceId;
    
    // Add to response header
    res.setHeader('X-Trace-ID', traceId);
    
    next();
  }
}
```

**Apply globally:**
```typescript
app.use(TraceIdMiddleware);
```

**Inject en logging:**
```typescript
this.logger.log('Reservation created', {
  traceId: request.traceId,
  reservationId: reservation.id,
});
```

**Commits:** 1 (combined)

---

#### 14.3 Request/Response Logging (1h)
**Archivo nuevo:** `apps/api/src/core/logging/http-logger.interceptor.ts`

```typescript
@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;
        this.logger.log('HTTP Request', {
          method: request.method,
          path: request.path,
          statusCode: 200,
          duration,
          traceId: request.traceId,
        });
      }),
    );
  }
}
```

**Commits:** 1 (combined)

---

### 1️⃣5️⃣ TASK: Monitoring Setup (5h)

**Objetivo:** Dashboard básico de health + alerts críticas

**Subtasks:**

#### 15.1 Health Check Endpoint (1h)
**Archivo nuevo:** `apps/api/src/core/health/health.controller.ts`

```typescript
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<{ status: string; checks: {} }> {
    return {
      status: 'ok',
      checks: {
        database: await this.dbHealthCheck(),
        redis: await this.redisHealthCheck(),
        meta: await this.metaHealthCheck(),
      },
    };
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "up", "latency": 5 },
    "redis": { "status": "up", "latency": 2 },
    "meta": { "status": "up", "error_rate": 0.01 }
  }
}
```

**Commits:** 1

---

#### 15.2 Metrics Endpoint (2h)
**Archivo nuevo:** `apps/api/src/core/metrics/metrics.controller.ts`

```typescript
import prom from 'prom-client';

@Controller('metrics')
export class MetricsController {
  private httpRequestsTotal = new prom.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });
  
  private reservationsCreatedTotal = new prom.Counter({
    name: 'reservations_created_total',
    help: 'Total reservations created',
  });
  
  @Get()
  metrics() {
    return prom.register.metrics();
  }
}
```

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: vitahub-api
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

**Commits:** 1

---

#### 15.3 Monitoring Dashboard (2h)
**Archivo nuevo:** `monitoring/grafana/dashboards/vitahub.json`

**Panels:**
- API Response time (p50, p95, p99)
- Request rate (by endpoint)
- Error rate
- Database query latency
- Redis cache hit rate
- Meta CAPI delivery rate
- Active users
- Reservation creation rate

**Commits:** 1 (combined)

---

### 1️⃣6️⃣ TASK: Alerting Rules (3h)

**Objetivo:** Alerts para issues críticos

**Subtasks:**

#### 16.1 Prometheus Alert Rules (1.5h)
**Archivo nuevo:** `monitoring/prometheus/alerts.yml`

```yaml
groups:
  - name: vitahub-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[5m])) by (instance))
          > 0.05
        for: 5m
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
      
      - alert: DatabaseLatencyHigh
        expr: histogram_quantile(0.99, db_query_duration_seconds) > 1
        for: 10m
        annotations:
          summary: "Database latency p99 > 1s"
      
      - alert: MetaCAPIDeliveryLow
        expr: |
          (sum(rate(meta_events_delivered[5m])) / 
           sum(rate(meta_events_enqueued[5m]))) < 0.95
        for: 30m
        annotations:
          summary: "Meta CAPI delivery rate < 95%"
      
      - alert: RedisUnavailable
        expr: redis_up == 0
        for: 1m
        annotations:
          summary: "Redis is down"
```

**Commits:** 1

---

#### 16.2 Alert Notification (Slack/Email) (1.5h)
**Archivo modificar:** `monitoring/alertmanager/config.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  receiver: vitahub-team
  
receivers:
  - name: vitahub-team
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_URL}
        channel: '#vitahub-alerts'
        text: '{{ .GroupLabels.alertname }}'
    email_configs:
      - to: ops@vitahub.com
        smarthost: smtp.example.com:587
        auth_username: alerts@example.com
        auth_password: ${SMTP_PASSWORD}
```

**Commits:** 1 (combined)

---

### 1️⃣7️⃣ TASK: Deployment Automation (6h)

**Objetivo:** CI/CD pipeline (GitHub Actions / GitLab CI)

**Subtasks:**

#### 17.1 GitHub Actions Workflow (3h)
**Archivo nuevo:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm install
      - run: npm run lint
      - run: npm run test:cov
      - run: npm run test:e2e
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t vitahub:${{ github.sha }} .
      - run: docker push ${{ secrets.REGISTRY }}/vitahub:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: |
          kubectl set image deployment/vitahub-api \
            vitahub-api=${{ secrets.REGISTRY }}/vitahub:${{ github.sha }}
```

**Commits:** 1

---

#### 17.2 Helm Chart (2h)
**Archivo nuevo:** `helm/vitahub/Chart.yaml`

```yaml
apiVersion: v2
name: vitahub
description: VitaHub Kubernetes deployment
type: application
version: 1.0.0
appVersion: "1.0.0"

dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
  - name: redis
    version: 17.x.x
    repository: https://charts.bitnami.com/bitnami
```

**Deploy:**
```bash
helm install vitahub ./helm/vitahub \
  --set image.tag=$(git rev-parse --short HEAD)
```

**Commits:** 1

---

#### 17.3 Infrastructure as Code (1h)
**Archivo nuevo:** `terraform/main.tf`

```hcl
resource "aws_eks_cluster" "vitahub" {
  name = "vitahub-prod"
  
  # Configuration
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier = "vitahub-db"
  engine = "aurora-postgresql"
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id = "vitahub-redis"
  engine = "redis"
}
```

**Commits:** 1 (combined)

---

---

## SEMANA 6: BUG FIXES & DOCUMENTATION (15h)

### 1️⃣8️⃣ TASK: Drag & Drop Bug Fix (4h)

**Objetivo:** Reproducir y fijar el bug ocasional reportado

**Subtasks:**

#### 18.1 Reproduce Bug (1h)
**Archivo:** `docs/bug-reports/drag-drop-issue.md`

```markdown
## Bug: Drag & Drop ocasionally fails

### Steps to reproduce:
1. Open Form Builder
2. Add 3+ fields
3. Drag field 2 to position 1
4. Drag field 1 to position 3
5. Observe: campos desordenados

### Root cause (hypothesis):
- State update race condition en dnd-kit
-或 React key issue en list rendering

### Solution:
- Update to dnd-kit v8+
- Add stable keys based on field ID (not index)
- Add tests
```

**Commits:** 1 (doc)

---

#### 18.2 Fix Implementation (2h)
**Archivo modificar:** `apps/web/src/features/forms/FormBuilderDnD.tsx`

```typescript
// BEFORE: using index as key (BAD)
{fields.map((field, index) => (
  <div key={index}>{field.name}</div>
))}

// AFTER: using field ID as key (GOOD)
{fields.map((field) => (
  <div key={field.id}>{field.name}</div>
))}
```

**Update dnd-kit:**
```json
{
  "@dnd-kit/core": "^7.0.0",
  "@dnd-kit/sortable": "^7.0.0"
}
```

**Commits:** 1

---

#### 18.3 QA Testing (1h)
**Archivo:** `e2e/tests/form-builder-drag-drop.spec.ts`

```typescript
describe('Form Builder Drag & Drop', () => {
  it('should reorder fields without corruption', async () => {
    // Steps + assertions
  });
  
  it('should maintain field IDs across reorders', async () => {
    // Steps + assertions
  });
});
```

**Commits:** 1 (combined with fix)

---

### 1️⃣9️⃣ TASK: Email Notification Retry (2h)

**Objetivo:** Evitar que emails fallen silenciosamente

**Archivo modificar:** `apps/api/src/core/email/email.service.ts`

```typescript
async sendReservationConfirmation(reservation) {
  try {
    await this.emailProvider.send({
      to: reservation.email,
      subject: 'Reserva Confirmada',
      template: 'reservation-confirmation',
    });
  } catch (error) {
    // Queue for retry
    await this.emailQueue.add({
      reservationId: reservation.id,
      type: 'confirmation',
      attempt: 1,
    });
    
    // Log error
    this.logger.error('Email send failed', {
      reservationId: reservation.id,
      error: error.message,
    });
  }
}

@Process()
async processEmailQueue(job: Job) {
  // Retry with exponential backoff
  if (job.data.attempt < 5) {
    try {
      await this.sendEmail(job.data);
      // Success
    } catch (error) {
      // Re-queue with attempt++
      await this.emailQueue.add(
        { ...job.data, attempt: job.data.attempt + 1 },
        { delay: Math.pow(2, job.data.attempt) * 1000 }
      );
    }
  }
}
```

**Tests:** 2
- Test: email queued on failure
- Test: retry with backoff

**Commits:** 1

---

### 2️⃣0️⃣ TASK: OpenAPI/Swagger (4h)

**Objetivo:** Generar documentación interactiva

**Subtasks:**

#### 20.1 Swagger Setup (1h)
**Archivo modificar:** `apps/api/src/main.ts`

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('VitaHub API')
  .setDescription('Reservation scheduling & CRM platform')
  .setVersion('1.0.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

**URL:** `https://api.vitahub.com/api/docs`

**Commits:** 1

---

#### 20.2 API Route Documentation (2h)
**Archivo:** Decorate all controllers

```typescript
@Controller('reservations')
@ApiTags('Reservations')
export class ReservationsController {
  @Post()
  @ApiOperation({ summary: 'Create reservation' })
  @ApiResponse({ status: 201, description: 'Reservation created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateReservationDto) {
    // ...
  }
}
```

**Commits:** 2

---

#### 20.3 Generated API Client (1h)
**Usando:** `@openapitools/openapi-generator-cli`

```bash
npx openapi-generator-cli generate \
  -i http://localhost:3000/api-json \
  -g typescript-axios \
  -o libs/sdk
```

**Generates:**
- Type-safe client library
- DTOs matching backend
- Easy integration in frontend

**Commits:** 1 (combined)

---

### 2️⃣1️⃣ TASK: Deployment Guide (3h)

**Objetivo:** Documentación para deploys en producción

**Archivo nuevo:** `docs/deployment-guide.md`

```markdown
# VitaHub Deployment Guide

## Pre-deployment checklist
- [ ] All tests passing
- [ ] Security audit passed
- [ ] Load testing: 1000 req/min OK
- [ ] Database backups configured
- [ ] Monitoring alerts configured

## Deployment steps
1. Tag commit: `git tag v1.0.0`
2. Push: `git push origin v1.0.0`
3. CI/CD pipeline auto-triggers
4. Approval required for prod
5. Helm deploy with rolling updates
6. Health checks verify deployment
7. Alerts monitoring enabled

## Rollback procedure
if deployment fails:
```bash
helm rollback vitahub 1
kubectl rollout undo deployment/vitahub-api
```

## Post-deployment
- [ ] Verify health endpoint: /health
- [ ] Check logs for errors
- [ ] Test critical flows (create reservation)
- [ ] Verify metrics in Grafana
- [ ] Monitor alert status
```

**Commits:** 1

---

### 2️⃣2️⃣ TASK: Troubleshooting Guide (2h)

**Objetivo:** Guía rápida para issues comunes

**Archivo nuevo:** `docs/troubleshooting.md`

```markdown
# VitaHub Troubleshooting Guide

## Reservation not created
1. Check rate limiting: `GET /health`
2. Check database connection: logs
3. Check validation: POST /reservations/test
4. Verify Meta CAPI config: settings

## Meta events not delivering
1. Check access token expiration
2. Check test event code in Meta Events Manager
3. Verify retry queue: SELECT * FROM meta_conversion_outbox
4. Check error logs: `tail -f error.log`

## High API latency
1. Check Redis connection: redis-cli ping
2. Check DB indexes: EXPLAIN on slow queries
3. Check cache hit rate: /metrics
4. Increase connection pool size

## Lead duplicates appearing
1. Check deduplication logic
2. Verify email normalization
3. Check phone E.164 conversion
4. Manual merge in admin panel
```

**Commits:** 1

---

---

## SUMMARY & TIMELINE

### Fase 0 Total: 97h

| Semana | Area | Horas | Status |
|---|---|---|---|
| 1-2 | Security | 13h | 4 tasks (rate limit, CSRF, HSTS, audit) |
| 2-3 | Testing | 40h | 5 tasks (Jest, ReservationsService, Meta, Lead, E2E) |
| 3-4 | Performance | 13h | 3 tasks (cache, indexes, async scoring) |
| 5 | Monitoring | 16h | 4 tasks (logging, monitoring, alerts, deploy) |
| 6 | Bugs & Docs | 15h | 4 tasks (drag-drop, email, API docs, guides) |

### Commits Expected: ~35

### Testing Coverage Target: >50%

### Timeline: 6 weeks (starting 2026-07-25)

### Go-Live: 2026-09-04

---

**NEXT STEP:** User validation + create tasks in backlog
