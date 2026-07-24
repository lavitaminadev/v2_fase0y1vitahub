---
name: marketing-campaigns
description: Gestionar y analizar campañas de Meta e Google en VITAHUB
category: marketing
disable-model-invocation: false
allowed-tools: Bash(npm *) Bash(curl *)
---

# Marketing Campaigns Skill

Gestionar campañas Meta e Google, tracking y analytics.

## Ver Campañas Integradas
```bash
curl http://localhost:3000/api/integrations/meta/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Crear Píxel de Meta
```bash
curl -X POST http://localhost:3000/api/integrations/meta/pixel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pixelId": "123456789",
    "name": "Sitio Principal",
    "status": "active"
  }'
```

## Rastrear Conversión
```bash
curl -X POST http://localhost:3000/api/integrations/meta/track-conversion \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pixelId": "123456789",
    "eventName": "Purchase",
    "data": {
      "content_type": "product",
      "content_id": "product-123",
      "value": 50.00,
      "currency": "USD"
    }
  }'
```

## Obtener Insights de Campaña
```bash
curl "http://localhost:3000/api/integrations/meta/insights?campaignId=123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Google Ads Integration
```bash
# Crear integración
curl -X POST http://localhost:3000/api/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "type": "google_ads",
    "credentials": {
      "developerToken": "tu-token",
      "customerIds": ["123-456-7890"]
    }
  }'
```

## Reporte de Performance
```bash
curl "http://localhost:3000/api/integrations/meta/performance?dateFrom=2026-07-01&dateTo=2026-07-23" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Conversión Tracking Setup
```javascript
// En tu sitio web:
// 1. Cargar píxel de Meta
fbq('init', 'YOUR_PIXEL_ID');

// 2. Rastrear evento de compra
fbq('track', 'Purchase', {
  value: 50.00,
  currency: 'USD',
  content_type: 'product'
});

// 3. VITAHUB recibe el evento automáticamente
```

## Checklist de Setup
- [ ] Meta App creada y conectada
- [ ] Píxel de Meta instalado en sitio
- [ ] Webhooks configurados
- [ ] Google Ads conectado (opcional)
- [ ] Conversiones rastreadas en Meta
- [ ] Eventos llegando a VITAHUB
