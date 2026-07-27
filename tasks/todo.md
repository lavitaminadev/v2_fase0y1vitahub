# VitaHub — tablero de entrega

Estados: `[x]` terminado y validado localmente; `[ ]` pendiente o dependiente de evidencia externa.

## Fase 0

- [ ] Recibir acceso iHosting y dominio de producción — responsable Nico — 21 jul 2026.
- [ ] Configurar DNS, HTTPS y variables productivas — responsable Maxi — 22 jul 2026.
- [ ] Nico inicia Business Verification — 21 jul 2026.
- [ ] Nico entrega acceso/documentos/activos Meta — 22 jul 2026.
- [ ] Maxi envía App Review `ads_read` con evidencias — 24 jul 2026.
- [x] Tokens cifrados y secretos fuera del navegador.

## Fase 1 — entrega 21 ago 2026

- [x] Hooks, persistencia cliente y conversión horaria corregidos.
- [x] Página pública móvil y confirmación editable.
- [x] Horario semanal, bloqueos y tope diario base.
- [x] Múltiples franjas semanales por día.
- [x] Bandeja, asistencia/no asistencia y CRM asociado.
- [x] Captura `fbclid`, `fbc`, `fbp`, IP y user agent.
- [x] Cola CAPI y eventos `Schedule` / `Reserva_Asistida`.
- [x] Deduplicación navegador/CAPI de `Schedule`.
- [x] Configuración explícita de Pixel y token por cliente.
- [x] Alta/edición con Sin Pixel, Agregar Pixel o Usar Pixel existente.
- [x] Capacidades predeterminadas y activables por empresa.
- [x] Configuración Pixel/CAPI directa sin depender de OAuth.
- [x] Publicación muestra Pixel, token, campaña y eventos que enviará.
- [x] Cloudinary conserva/valida credenciales y evita sobrescrituras por nombre.
- [x] Aislamiento del Pixel en SPA mediante `trackSingle` por Pixel.
- [ ] Prueba con Pixel real y Event Match Quality visible.
- [ ] Prueba end-to-end con cliente piloto.
- [ ] Publicación HTTPS y enlace entregado.

## Fase 2 — objetivo 18 sep 2026

- [ ] App Review `ads_read` aprobado.
- [ ] Lectura aislada de métricas por cuenta/cliente.
- [ ] Cruce inversión y campaña con reservas/asistencias.
- [ ] Panel sólo lectura validado por cliente.
- [ ] QA real y aceptación.

## Criterios de aceptación

- [ ] Bloqueo de fecha y franja se refleja inmediatamente.
- [ ] Dos franjas del mismo día funcionan.
- [ ] Tope diario resiste concurrencia y muestra completo.
- [ ] Reserva y contacto quedan en cliente/campaña correctos.
- [ ] `Schedule` aparece con match y sin duplicación.
- [ ] `Reserva_Asistida` aparece una sola vez.
- [ ] Reintento dentro de siete días verificado.
- [ ] Cliente A no puede leer/escribir ni usar Pixel de cliente B.

## Fuera de alcance confirmado

- [x] Sin mesas ni capacidad por mesa/franja.
- [x] Sin pagos ni cupones en el flujo de Fase 1.
- [x] Sin WhatsApp/SMS.
- [x] Sin automatizaciones, scoring ni secuencias.
- [x] Sin `ads_management`.

## Reviews

- [ ] Sprint Review 1 — 31 jul 2026.
- [ ] Sprint Review 2 — 14 ago 2026.
- [ ] Sprint Review 3 — 28 ago 2026.
- [ ] Sprint Review 4 — 11 sep 2026.
