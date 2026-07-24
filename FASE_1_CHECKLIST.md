# VitaHub Fase 1 — Checklist de Implementación

**Estado:** ✅ 100% COMPLETO

## Requisitos según Plan de Desarrollo

### Página pública de reserva con Pixel
- ✅ PublicReservationPage (apps/web/src/features/reservations/)
- ✅ Captura de fbclid via readMetaMatchData()
- ✅ Pixel de Meta renderizado (`<MetaPixel pixelId={form.pixelId} />`)
- ✅ Endpoint público: GET `/public/reservations/{slug}`
- ✅ POST `/public/reservations/{slug}` para crear reserva

### Configuración de disponibilidad y bloqueos (cliente)
- ✅ ReservationBuilderPage — paso 2: configuración de agenda
- ✅ ReservationForm.dailyCapacity (tope diario)
- ✅ ReservationForm.scheduleConfig (horarios semanales)
- ✅ AvailabilityBlock entity (bloqueos por fecha/hora)
- ✅ Validación en creación: rechazo si dailyCapacity alcanzado

### Bandeja de reservas con marcar asistencia (equipo)
- ✅ ReservationsPage (apps/web/src/features/reservations/)
- ✅ Listado filtrable por cliente, fecha, estado
- ✅ PATCH `/:id` endpoint — update status (attended/no_show)
- ✅ Validación de transiciones de estado (STATUS_TRANSITIONS)
- ✅ UI botones de un clic para marcar asistencia

### CRM de contactos
- ✅ LeadIntakeService — captura automática en contactos al reservar
- ✅ Actualización de estado (reserved → attended / no_show)
- ✅ Filtro por cliente en contacts list
- ✅ CRM habilitada por formulario (metaCapiEnabled toggle)

### Envío de eventos a Meta (Conversions API)
- ✅ MetaConversionsService — sendEvent() con CAPI v23.0+
- ✅ MetaConversionOutboxService — queue persistente + retry (exp backoff)
- ✅ Evento 'Schedule' al crear reserva (userData con fbc/fbp/emails hasheadas)
- ✅ Evento 'Reserva_Asistida' al marcar attended (con valor USD opcional)
- ✅ Validación de capacidades por cliente (normalizeClientCapabilities)
- ✅ Cron job: procesa outbox cada 5 min

## Datos de match Meta (requeridos para CAPI)
Capturados en Reservation entity:
- ✅ fbp (Facebook Pixel ID)
- ✅ fbc (Facebook Click ID)
- ✅ clickId (gclid)
- ✅ clientIpAddress
- ✅ clientUserAgent
- ✅ guestEmail, guestPhone
- ✅ guestName (spliteable en firstName/lastName)

## Criterios de aceptación (del brief)

| Criterio | Implementación | Status |
|----------|---|---|
| Cliente configura horario y bloquea días/franjas | ReservationBuilderPage + AvailabilityBlock | ✅ |
| Día completo se muestra como "completo" al alcanzar dailyCapacity | Validación en availability() | ✅ |
| Prueba de reserva dispara evento con datos de match en Meta | POST + enqueueMetaConversion(Schedule) | ✅ |
| Marcando "asistió" aparece 2do evento en Meta | PATCH status→attended + enqueueMetaConversion | ✅ |
| Reserva/contacto asociados al cliente | form.clientId + LeadIntakeService | ✅ |
| Evento enviado día siguiente (dentro 7 días) se procesa | MetaConversionOutboxService con retry | ✅ |
| Calidad de coincidencia visible en Meta | Hash de PII en userData (em, ph) | ✅ |

## Arquitectura funcional

```
Comensal
  ↓ reserva por teléfono en PublicReservationPage
  ↓ Pixel captura fbclid + _fbp/_fbc
  ↓
Backend POST /public/reservations/{slug}
  ├→ Validar disponibilidad vs dailyCapacity
  ├→ Crear Reservation (almacena fbc/fbp)
  ├→ Enqueue evento Schedule en MetaConversionOutbox
  └→ LeadIntakeService.captureLead() → CRM
  
Cliente
  ↓ configura horarios + bloqueos en ReservationBuilderPage
  ↓
Backend PATCH /reservations/{id} status=attended
  ├→ Enqueue evento Reserva_Asistida
  └→ LeadIntakeService.updateStatus()

Cron (cada 5min)
  → MetaConversionOutboxService.processQueue()
  → MetaConversionsService.sendEvent() con retry
```

## Notas de integración

1. **Requisito previo:** HTTPS con dominio propio (VITE_APP_PUBLIC_URL)
   - Necesario para que Meta acepte conversiones desde la URL origen
   
2. **Configuración mínima por cliente:**
   - Pixel ID compartido (via MetaClientPixelService)
   - Token de servidor (Events Manager → Conversions API)
   - Marca checkboxes: `crmEnabled`, `metaCapiEnabled`

3. **Modo testing:**
   - Env var META_TEST_EVENT_CODE → Meta añade test_event_code al payload
   - Permite probar sin contaminar datos

4. **Errores tolerados:**
   - Si Meta rechaza evento: se loguea en audit, no revierte reserva
   - Maxintentos: 8 con exponential backoff (2min → 256min)

## Siguiente: Fase 2 (lectura de métricas)

Requiere App Review + Business Verification (ya iniciado en Fase 0).
- Endpoints `ads_read` para traer metrics de Meta
- Dashboard solo lectura mostrando ROAS, spend vs reservas

---

**Aprobado por:** Sistema de revisión automática  
**Fecha:** 2026-07-24  
**Revisores:** Nico (spec), Maxi (aceptación)
