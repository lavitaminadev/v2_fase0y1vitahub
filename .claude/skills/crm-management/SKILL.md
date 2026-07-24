---
name: crm-management
description: Gestión de leads, oportunidades y contactos en VITAHUB CRM
category: sales
disable-model-invocation: false
allowed-tools: Bash(npm *) Bash(curl *)
---

# CRM Management Skill

Gestionar leads, oportunidades y contactos en VITAHUB.

## Crear Lead
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Juan",
    "lastName": "García",
    "email": "juan@example.com",
    "phone": "+34 91 234 5678",
    "company": "Acme Corp",
    "source": "meta_ads",
    "status": "new",
    "notes": "Lead de campaña Summer2026"
  }'
```

## Listar Leads
```bash
curl http://localhost:3000/api/leads \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Actualizar Lead a Oportunidad
```bash
curl -X PUT http://localhost:3000/api/leads/{id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "qualified",
    "leadScore": 85
  }'
```

## Crear Oportunidad
```bash
curl -X POST http://localhost:3000/api/opportunities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-123",
    "title": "Propuesta: Diseño web + Marketing",
    "amount": 50000,
    "currency": "USD",
    "probability": 60,
    "closeDate": "2026-09-30"
  }'
```

## Ver Pipeline
```bash
curl http://localhost:3000/api/crm/pipeline \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Agregar Interacción
```bash
curl -X POST http://localhost:3000/api/interactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-123",
    "type": "call",
    "date": "2026-07-23",
    "duration": 15,
    "notes": "Cliente interesado, siguiente paso: propuesta",
    "nextStep": "enviar propuesta",
    "nextDate": "2026-07-24"
  }'
```

## Conversión Lead → Cliente
```bash
curl -X POST http://localhost:3000/api/leads/{id}/convert \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Acme Corp",
    "communityManagerId": "user-456",
    "industry": "Technology",
    "retainerAmount": 5000,
    "currency": "USD"
  }'
```

## Analytics
```bash
# Reporte de leads por fuente
curl http://localhost:3000/api/crm/analytics/leads-by-source \
  -H "Authorization: Bearer YOUR_TOKEN"

# Tiempo promedio de conversión
curl http://localhost:3000/api/crm/analytics/conversion-time \
  -H "Authorization: Bearer YOUR_TOKEN"

# Pipeline forecast
curl http://localhost:3000/api/crm/analytics/pipeline-forecast \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Webhooks de Meta Lead Ads

VITAHUB recibe leads automáticamente de Meta. Verifica:
```bash
# Ver configuración
cat apps/api/src/modules/integrations/meta/meta-lead-ads.service.ts

# Ver logs de leads recibidos
npm run dev:api  # Abre en modo desarrollo y revisa console
```

## Variables de Entorno Necesarias
```
META_APP_ID=tu-app-id
META_APP_SECRET=tu-app-secret
META_WEBHOOK_VERIFY_TOKEN=tu-token
```
