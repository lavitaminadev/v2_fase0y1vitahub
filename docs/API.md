# API VITAHUB

Documentación de los endpoints REST de la API de VITAHUB.

Base URL: `http://localhost:3000/api`

Autenticación: `Bearer <token>` en header `Authorization`.

---

## Autenticación

### POST /auth/register

Registrar un nuevo usuario.

- **Auth**: No
- **Body**:
  ```json
  {
    "email": "user@agency.cl",
    "password": "mi-password",
    "name": "Juan Pérez",
    "organizationId": "uuid (opcional)"
  }
  ```
- **Response 201**:
  ```json
  {
    "accessToken": "jwt...",
    "refreshToken": "jwt...",
    "user": { "id": "uuid", "name": "Juan Pérez", "email": "user@agency.cl", "role": "designer" }
  }
  ```

### POST /auth/login

Iniciar sesión.

- **Auth**: No
- **Body**:
  ```json
  { "email": "user@agency.cl", "password": "mi-password" }
  ```
- **Response 200**:
  ```json
  {
    "accessToken": "jwt...",
    "refreshToken": "jwt...",
    "user": { "id": "uuid", "name": "Juan Pérez", "email": "...", "role": "designer", "avatarUrl": null }
  }
  ```

### POST /auth/refresh

Renovar access token.

- **Auth**: No
- **Body**:
  ```json
  { "refreshToken": "jwt..." }
  ```
- **Response 200**:
  ```json
  { "accessToken": "jwt..." }
  ```

### GET /auth/me

Obtener perfil del usuario autenticado.

- **Auth**: Sí (Bearer)
- **Response 200**: Objeto `User`

---

## Health

### GET /health

Health check general.

- **Auth**: No
- **Response 200**:
  ```json
  {
    "status": "ok",
    "uptime": 12345,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "database": { "status": "ok", "connected": true },
    "memory": { "status": "ok", "freeMb": 1024, "totalMb": 8192, "usagePercent": "45.2%" },
    "disk": { "status": "ok", "writable": true },
    "redis": { "status": "ok", "connected": true }
  }
  ```

### GET /health/db

Health check específico de base de datos.

- **Auth**: No
- **Response 200**: `{ "status": "ok", "connected": true }`

---

## Organizaciones

### POST /organizations

Crear una organización.

- **Auth**: No
- **Body**: `{ "name": "Agencia XYZ", "code": "agency-xyz", "currency": "CLP" }`

### GET /organizations

Listar organizaciones.

- **Auth**: Sí (Bearer)

---

## Usuarios

### GET /users

Listar usuarios. Filtro opcional: `?organizationId=uuid`

- **Auth**: Sí (Bearer)

### POST /users

Crear usuario.

- **Auth**: Sí (Bearer)
- **Body**: `{ "name": "...", "email": "...", "password": "...", "role": "designer", "organizationId": "uuid" }`

---

## CRM - Leads

### POST /crm/leads

Crear lead.

- **Auth**: Sí (Bearer)
- **Body**:
  ```json
  {
    "name": "Cliente Potencial",
    "email": "contacto@empresa.cl",
    "phone": "+56912345678",
    "company": "Empresa SpA",
    "source": "referral",
    "notes": "Contacto inicial"
  }
  ```

### GET /crm/leads

Listar leads. Filtro opcional: `?status=new`

- **Auth**: Sí (Bearer)

### POST /crm/leads/:id/convert

Convertir lead a cliente.

- **Auth**: Sí (Bearer)

---

## Clientes

### GET /clients

Listar clientes de la organización.

- **Auth**: Sí (Bearer)

### POST /clients

Crear cliente.

- **Auth**: Sí (Bearer)
- **Body**:
  ```json
  {
    "leadId": "uuid (opcional)",
    "name": "Cliente SPA",
    "industry": "retail",
    "retainerAmount": 500000,
    "defaultUdBudget": 20
  }
  ```

### GET /clients/:id

Obtener detalle de cliente.

- **Auth**: Sí (Bearer)

---

## Producción (Piezas)

### GET /production/pieces

Listar piezas. Filtros opcionales: `?status=in_progress&clientId=uuid&assignedTo=uuid`

- **Auth**: Sí (Bearer)

### POST /production/pieces/:id/assign

Asignar diseñador a pieza.

- **Auth**: Sí (Bearer)
- **Body**: `{ "designerId": "uuid" }`

### POST /production/pieces/:id/versions

Subir nueva versión de pieza.

- **Auth**: Sí (Bearer)
- **Body**: `{ "fileName": "pieza_v3.png", "driveFileId": "abc123" }`

### POST /production/pieces/:id/reject

Rechazar y solicitar corrección.

- **Auth**: Sí (Bearer)
- **Body**: `{ "reason": "Ajustar colores corporativos" }`

### POST /production/pieces/:id/deliver

Entregar pieza al cliente.

- **Auth**: Sí (Bearer)

---

## Presupuesto de Diseño (UD)

### POST /design-budget/budget

Obtener o crear presupuesto del mes.

- **Auth**: Sí (Bearer)
- **Body**: `{ "clientId": "uuid", "year": 2024, "month": 6, "defaultBudget": 20 }`

### POST /design-budget/reserve

Reservar UDs.

- **Auth**: Sí (Bearer)
- **Body**: `{ "clientId": "uuid", "pieceId": "uuid", "amount": 5, "year": 2024, "month": 6 }`

### POST /design-budget/confirm

Confirmar consumo de UDs.

- **Auth**: Sí (Bearer)
- **Body**: `{ "clientId": "uuid", "pieceId": "uuid", "year": 2024, "month": 6 }`

---

## Gamificación

### POST /gamification/xp/delivery

Registrar XP por entrega a tiempo.

- **Auth**: Sí (Bearer)
- **Body**: `{ "pieceId": "uuid", "userId": "uuid" }`

### POST /gamification/xp/penalty

Registrar penalización XP.

- **Auth**: Sí (Bearer)
- **Body**: `{ "pieceId": "uuid", "userId": "uuid", "reason": "Entrega tardía" }`

### GET /gamification/ranking

Obtener ranking semanal de XP.

- **Auth**: Sí (Bearer)

---

## Reuniones

### POST /meetings

Crear reunión.

- **Auth**: Sí (Bearer)
- **Body**:
  ```json
  {
    "title": "Reunión semanal",
    "type": "weekly",
    "scheduledAt": "2024-06-10T15:00:00Z",
    "durationMinutes": 60,
    "location": "Oficina",
    "meetingLink": "https://meet.google.com/abc"
  }
  ```

### GET /meetings

Listar reuniones. Filtro opcional: `?type=weekly`

- **Auth**: Sí (Bearer)

---

## Parrillas de Contenido

### POST /content/grids

Crear parrilla de contenido semanal.

- **Auth**: Sí (Bearer)
- **Body**:
  ```json
  {
    "clientId": "uuid",
    "title": "Semana 24",
    "weekStart": "2024-06-10",
    "weekEnd": "2024-06-16"
  }
  ```

### GET /content/grids

Listar parrillas. Filtro opcional: `?clientId=uuid`

- **Auth**: Sí (Bearer)

---

## Integraciones

### POST /integrations

Crear integración.

- **Auth**: Sí (Bearer)
- **Body**:
  ```json
  {
    "provider": "meta",
    "name": "Meta Ads Principal",
    "config": { "accessToken": "..." }
  }
  ```

### GET /integrations

Listar integraciones. Filtro opcional: `?provider=meta`

- **Auth**: Sí (Bearer)

---

## Facturación

### GET /billing/invoices

Listar facturas.

- **Auth**: Sí (Bearer)

---

## Briefs

### POST /briefs

Crear brief.

- **Auth**: Sí (Bearer)

### GET /briefs

Listar briefs.

- **Auth**: Sí (Bearer)

### GET /briefs/:id

Obtener brief.

- **Auth**: Sí (Bearer)

### PUT /briefs/:id

Actualizar brief.

- **Auth**: Sí (Bearer)

### DELETE /briefs/:id

Eliminar brief.

- **Auth**: Sí (Bearer)

---

## Documentos

### POST /documents

Crear documento.

- **Auth**: Sí (Bearer)

### GET /documents

Listar documentos.

- **Auth**: Sí (Bearer)

### GET /documents/:id

Obtener documento.

- **Auth**: Sí (Bearer)

### PUT /documents/:id

Actualizar documento.

- **Auth**: Sí (Bearer)

### DELETE /documents/:id

Eliminar documento.

- **Auth**: Sí (Bearer)

---

## Subida de Archivos

### POST /uploads

Subir archivo (multipart/form-data).

- **Auth**: No (usa headers `x-org-id` y `x-user-id`)
- **Body**: Multipart form con campo `file`

### GET /uploads/:id

Obtener metadatos del archivo.

- **Auth**: No

### DELETE /uploads/:id

Eliminar archivo.

- **Auth**: No

---

## Notificaciones

### GET /notifications

Listar notificaciones del usuario.

- **Auth**: No (usa header `x-user-id`)

### GET /notifications/unread-count

Obtener cantidad de no leídas.

- **Auth**: No (usa header `x-user-id`)
- **Response**: `{ "unread": 5 }`

### PUT /notifications/:id/read

Marcar notificación como leída.

- **Auth**: No (usa header `x-user-id`)

---

## Dashboard

### GET /dashboard/overview

Dashboard general (cantidad clientes, piezas, leads, UDs).

- **Auth**: Sí (Bearer)

### GET /dashboard/production

Dashboard de producción.

- **Auth**: Sí (Bearer)

### GET /dashboard/financial

Dashboard financiero.

- **Auth**: Sí (Bearer)

---

## Reportes

### GET /reporting/dashboard

Reporte ejecutivo con estadísticas agregadas.

- **Auth**: Sí (Bearer)

---

## Métricas

### GET /metrics

Métricas del sistema (solo admin).

- **Auth**: Sí (Bearer, rol admin)

---

## Swagger UI

Una vez configurado, la documentación interactiva está disponible en:

```
http://localhost:3000/api/docs
```
