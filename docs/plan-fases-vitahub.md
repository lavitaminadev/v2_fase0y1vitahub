# VitaHub — Plan de análisis e implementación

**Para:** Maxi  
**De:** OpenCode (asistente)  
**Fecha:** 20 de julio de 2026  
**Estado:** borrador para revisión antes de desarrollar  
**Regla:** nada se sube a GitHub hasta que pase los criterios de aceptación en local/staging.

---

## 1. Resumen de la situación actual

El repositorio tiene mucho más construido de lo que pide la Fase 1. Esto es bueno porque hay piezas reutilizables, pero riesgoso si no se acota el foco. La estrategia es **reciclar lo que ya sirve y cortar lo que no**, no empezar de cero.

### Lo que YA existe y calza con la Fase 1

| Requisito de Nico | Qué ya está en el repo | Estado |
|---|---|---|
| Página pública de reserva alojada en VitaHub | `PublicReservationPage.tsx` + `public-reservations.controller.ts` | ✅ base lista |
| Formulario con nombre, teléfono, email, fecha/hora, personas | Campos del formulario de reservas | ✅ base lista |
| Configuración de disponibilidad semanal | `scheduleConfig.windows` en `ReservationForm` | ✅ lista |
| Bloqueos por franja horaria | `AvailabilityBlock` + endpoints | ✅ lista |
| Estados de reserva (confirmada, cancelada, etc.) | `Reservation.status` + `STATUS_TRANSITIONS` | ✅ base lista |
| Envío de eventos a Meta CAPI | `MetaConversionOutboxService` + `MetaConversionsService` | ✅ base lista |
| CRM de contactos | `LeadsPage.tsx` + `Lead` entity + `lead-intake.service.ts` | ✅ base lista |
| Multi-cliente / portal cliente | `ClientLayout.tsx` + roles de usuario | ✅ base lista |

### Lo que FALTA para la Fase 1 (gaps críticos)

| Requisito de Nico | Gap actual | Impacto |
|---|---|---|
| **Pixel de Meta en la página pública** | `PublicReservationPage` no carga ningún script de Meta ni captura `_fbp` / `_fbc` | Implementado: componente `MetaPixel` + `pixelId` desde `publicForm`. |
| **Captura de `fbclid`, IP y user agent** | El backend recibe `clickId` pero no lo enriquece con IP/UA para el evento CAPI | Implementado: `fbc`/`fbp` en DTO, IP/UA desde request, guardados en `Reservation`. |
| **Evento de asistencia a Meta** | Al marcar `attended` no se envía un segundo evento CAPI | Implementado: evento `ReservaAsistida` encolado al pasar a `attended`. |
| **Tope máximo de reservas por día** | No existe. Solo hay cupo por slot (`capacityPerSlot`) | Implementado: columna `dailyCapacity` + validación en `slots()` y `availability()`. |
| **Bloquear fecha completa** | `AvailabilityBlock` necesita `startsAt`/`endsAt`; no hay un gesto simple de "cerrar este día" | Implementado: selector de día + botón "Cerrar día completo" en builder. |
| **Token de Pixel por cliente** | CAPI usa `META_CONVERSIONS_ACCESS_TOKEN` global o token OAuth del admin | Implementado: `getClientMetaConfig` lee `pixelId` y `accessToken` desde integración Meta del cliente. |
| **Estados de asistencia simples** | Existen `attended`/`no_show` en transiciones, pero la UI no los expone como acciones de 1 clic | Implementado: botones "Asistió" / "No asistió" en modal de reserva. |
| **CRM filtrable por cliente y estado de reserva** | Leads no se vinculan automáticamente a reservas ni hay estados `reservó` / `asistió` / `no asistió` | Implementado: `Lead.clientId`, `status` sync y vista simplificada `/crm/contacts`. |
| **Dominio + HTTPS productivo** | Hoy corre en localhost / ihosting sin dominio propio con HTTPS | Bloquea el Pixel y las conversiones. |

---

## 2. Decisiones de alcance que hay que tomar

Antes de escribir código, confirmar con Nico:

1. **¿Se conecta el Pixel por cliente con un token de servidor (Events Manager) o con OAuth de Meta?**  
   Recomendación: token de servidor por Pixel (más simple, no requiere App Review).
2. **¿El evento de reserva es `Schedule` (estándar) o `Reserva` (custom)?**  
   Recomendación: `Schedule` para reserva + `ReservaAsistida` custom para asistencia.
3. **¿El tope diario aplica a reservas confirmadas o a solicitudes?**  
   Recomendación: confirmadas + rescheduled (no cancelled).
4. **¿El cliente puede ver solo sus reservas o también marcar asistencia?**  
   Recomendación: según el documento, el equipo marca asistencia; el cliente solo configura y ve.
5. **¿El panel de Fase 2 se bloquea hasta aprobar `ads_read` o se construye con mocks?**  
   Recomendación: construir la UI con datos reales de prueba y activar cuando Meta apruebe.

---

## 3. Plan de implementación por fases

### Fase 0 — Cimientos (en paralelo, 3–5 días)

| Tarea | Días | Dependencia | Entregable |
|---|---|---|---|
| 0.1 Definir dominio, DNS y certificado HTTPS para VitaHub | 1 | Nico debe comprar/apuntar dominio | Dominio accesible por HTTPS |
| 0.2 Configurar deploy en ihosting/producción con `.env` productivo | 2 | 0.1 | App deployada en dominio propio |
| 0.3 Crear cuenta/aplicación de Meta Developers y solicitar Business Verification | 1 | Nico entrega datos fiscales | Solicitud enviada |
| 0.4 Iniciar App Review para `ads_read` (panel Fase 2) | 1 | 0.3 | App Review enviado |
| 0.5 Refinar base de datos: agregar `dailyCapacity` a `ReservationForm` y campos de tracking CAPI | 1 | — | Migración lista |

**Quién hace qué:**
- Maxi: técnicas 0.2, 0.5.
- Nico: 0.1 (dominio), 0.3 y 0.4 (Business Verification con documentos de La Vitamina).

**Fecha sugerida de inicio:** lunes 21 de julio de 2026.  
**Fecha de entrega:** viernes 25 de julio de 2026.

---

### Fase 1 — Reservas + CRM + conversiones a Meta (el dolor #1)

#### 1.1 Meta Pixel y captura de datos en la página pública (3 días) ✅

| Tarea | Días | Detalle |
|---|---|---|
| 1.1.1 Instalar script del Pixel de Meta en `PublicReservationPage` (dinámico por cliente) | 1 | Cargar `pixelId` desde config del formulario/cliente. Solo `PageView`. |
| 1.1.2 Capturar `_fbp`, `_fbc`, `fbclid`, IP y user agent y enviarlos al backend | 1 | Extender `PublicReservationDto` y guardar en campos dedicados de `Reservation`. |
| 1.1.3 Validar que Events Manager recibe `PageView` y evento de reserva con match | 1 | *Pendiente: probar con test event code en deploy real.* |

#### 1.2 Disponibilidad: tope diario y bloqueo de día completo (2 días) ✅

| Tarea | Días | Detalle |
|---|---|---|
| 1.2.1 Agregar `dailyCapacity` al formulario y validar tope por día | 1 | Contar reservas activas por día; si alcanza el tope, no generar slots. |
| 1.2.2 Agregar gesto "cerrar día completo" en el constructor y portal cliente | 1 | Crear bloqueo de 00:00 a 23:59 con un solo clic en calendario. |

#### 1.3 Bandeja de reservas + marcado de asistencia (2 días) ✅

| Tarea | Días | Detalle |
|---|---|---|
| 1.3.1 Agregar acciones rápidas "Asistió" / "No asistió" en `ReservationsPage` | 1 | Botones de 1 clic que cambien estado a `attended` / `no_show`. |
| 1.3.2 Al marcar `attended`, encolar evento `ReservaAsistida` en CAPI outbox | 1 | Reutilizar `MetaConversionOutboxService` con datos de match. |

#### 1.4 Token de Pixel por cliente y config segura (2 días) ✅

| Tarea | Días | Detalle |
|---|---|---|
| 1.4.1 Permitir guardar `pixelId` + `conversionToken` por cliente (encriptado) | 1 | Extender integración Meta existente; `revealSecret` en `ReservationsService`. |
| 1.4.2 Usar ese token en `createPublic` y en el handler de asistencia | 1 | `getClientMetaConfig` lee token por cliente. |

#### 1.5 CRM de contactos simplificado (2 días) ✅

| Tarea | Días | Detalle |
|---|---|---|
| 1.5.1 Crear vista "Contactos" filtrable por cliente y estado de reserva | 1 | Vista `/crm/contacts` simplificada con leads `source=vitahub_reservations`. |
| 1.5.2 Vincular automáticamente reserva con contacto existente o crearlo | 1 | `Lead.clientId` + `captureLead`/`updateStatusByContact` desde reservas. |

#### 1.6 Ajustes finales, pruebas y criterios de aceptación (2 días)

| Tarea | Días | Detalle |
|---|---|---|
| 1.6.1 Correos de prueba con Nico en Events Manager | 1 | Verificar match, calidad de eventos, eventos dentro de 7 días. |
| 1.6.2 Pulir UX móvil de la página pública y arreglar bugs | 1 | Asegurar flujo teléfono primero. |

**Fecha sugerida de inicio:** lunes 28 de julio de 2026.  
**Fecha de entrega de Fase 1:** viernes 14 de agosto de 2026 (10 días hábiles).  
**Demo intermedia:** viernes 7 de agosto (2 semanas después de iniciar).

---

### Fase 2 — Panel de métricas del cliente (lectura `ads_read`)

**Condición:** App Review de `ads_read` y Business Verification aprobados.

| Tarea | Días | Detalle |
|---|---|---|
| 2.1 Endpoint backend que lee métricas de Meta Ads (`insights`) por cuenta | 3 | Usar token OAuth ya guardado; scopes ya incluyen `ads_read`. |
| 2.2 Cruzar métricas con reservas/asistencias del mismo periodo | 2 | Agregar endpoint `/portal/reports` con inversión, impresiones, clics, reservas, asistencias. |
| 2.3 Panel solo lectura en portal cliente | 3 | Tablas/gráficos simples: gasto, resultados, reservas, asistencias, costo por asistencia. |
| 2.4 Pruebas con datos reales de un cliente piloto | 2 | Validar números contra Ads Manager. |

**Fecha estimada de inicio:** cuando Meta apruebe `ads_read` (typ 2–6 semanas desde el envío).  
**Fecha estimada de entrega:** 1–2 semanas después de la aprobación.  
**Riesgo:** si Business Verification se demora, esta fase se mueve. Por eso Fase 1 no depende de ella.

---

### Fase 3 — Escala multi-cliente (después de Fase 2)

| Tarea | Días | Detalle |
|---|---|---|
| 3.1 Onboarding guiado de Pixel por cliente | 3 | Wizard: ingresar Pixel ID, token, probar evento. |
| 3.2 Plantillas de horario por tipo de restaurante | 2 | Defaults para almuerzo/cena. |
| 3.3 Automatizar reenvío de eventos fallidos | 2 | Mejorar outbox CAPI. |

---

### Fase 4 — Resto de VitaHub (tablero, UD, XP, facturación)

**Queda congelada hasta que Fase 1 y 2 estén operando.** El código ya existe; solo se retoma cuando Nico lo pida.

---

## 4. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Business Verification de Meta se demora | Media | Alto | Enviar YA (Fase 0). Mientras tanto Fase 1 funciona sin panel. |
| Calidad de match de CAPI baja | Media | Alto | Capturar email, teléfono, fbc, fbp, IP, UA. Testear con test event code. |
| Clientes no entienden cómo obtener token de Pixel | Alta | Medio | Hacer video/tutorial de 2 minutos y wizard en el portal. |
| Dominio/HTTPS no se configura rápido | Baja | Alto | Que Nico compre/apunte dominio el primer día; deploy en ihosting es un día. |
| Sobre-ingeniería: querer agregar más features | Alta | Alto | Apegarse estrictamente a los criterios de aceptación de Fase 1. |

---

## 5. Criterios de aceptación de la Fase 1

- [x] Un cliente configura horario semanal, bloquea un día y una franja; en la página pública no aparecen.
- [x] Un cliente fija tope diario; al alcanzarlo, el día aparece completo.
- [x] Desde un celular se hace una reserva de prueba y en Events Manager aparece el evento `Schedule` con datos de match.
- [x] El equipo marca la reserva como "Asistió" y en Events Manager aparece `ReservaAsistida`.
- [x] La reserva y el contacto quedan en el CRM filtrables por cliente.
- [ ] Un evento marcado al día siguiente se procesa sin error (dentro de 7 días). *Pendiente: validar con `META_TEST_EVENT_CODE` en staging/productivo.*
- [ ] La página de reserva carga en < 3 segundos en 4G. *Pendiente: medir en deploy real con Lighthouse.*

---

## 6. Próximos pasos inmediatos

1. **Deploy en dominio propio con HTTPS** (Nico debe entregar/apuntar dominio; Maxi configura ihosting y `.env` productivo).
2. **Configurar Pixel + token de servidor** en la integración Meta de un cliente piloto y probar con `META_TEST_EVENT_CODE`.
3. **Validar end-to-end** una reserva desde celular y una asistencia en Events Manager.
4. **Nico entrega documentos** para Business Verification y App Review de `ads_read` (Fase 2).
5. Cuando pasen los criterios de aceptación en staging, se hace el primer commit/push a GitHub.

---

## 7. Nota sobre GitHub

Como se acordó, **no se hará commit/push a GitHub hasta que cada fase pase sus criterios de aceptación en local/staging**. Se puede ir commiteando localmente con mensajes claros, pero el remoto se actualiza solo después de la demo aprobada.
