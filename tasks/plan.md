# VitaHub — plan comprometido por fases

Fecha base: 20 de julio de 2026. Este plan traduce el alcance entregado por Nico a incrementos demostrables de no más de cinco días hábiles. La regla es profundidad antes que amplitud: un circuito real de campaña → reserva → asistencia → Meta antes de ampliar VitaHub.

## Resultado prioritario

Un cliente real publica un enlace HTTPS de VitaHub en sus anuncios. El comensal reserva desde el teléfono; VitaHub conserva campaña y datos de match; el equipo marca asistencia; Meta recibe `Schedule` y `Reserva_Asistida` por CAPI usando exclusivamente el Pixel y token cifrado de ese cliente.

## Alcance de Fase 1

- Reserva pública móvil: nombre, teléfono, email opcional, personas, fecha y hora.
- Horario semanal con múltiples franjas por día, bloqueos de fecha/franja y tope diario por número de reservas.
- Bandeja filtrable por cliente/fecha, asistencia y no asistencia en un clic.
- CRM básico de contactos filtrable por cliente/estado.
- Asociación cliente ↔ Pixel/token ↔ campaña ↔ reserva ↔ contacto.
- Pixel del cliente, captura de `fbclid`, `_fbc`, `_fbp`, IP y user agent.
- CAPI con email/teléfono hasheados, cola, reintentos, deduplicación y eventos `Schedule` / `Reserva_Asistida`.
- Enlace público construido desde `APP_PUBLIC_URL`, bajo HTTPS en producción.

Fuera de alcance: mesas, capacidad por mesa/franja, turnos, pagos, cupones, WhatsApp/SMS, automatizaciones, lead scoring, campañas desde VitaHub y `ads_management`.

## Cronograma

| ID | Fechas | Máximo | Entregable verificable |
|---|---|---:|---|
| F0.1 | 21–22 jul 2026 | 2 días | Dominio, DNS, SSL, variables productivas y health check preparados con iHosting. |
| F0.2 | 21–23 jul 2026 | 3 días | Modelo cliente–Pixel/token–campaña–reserva–contacto y secretos cifrados. |
| F0.3 | 21–24 jul 2026 | 4 días | Evidencias y envío de Business Verification/App Review `ads_read`, sujeto a accesos de Nico. |
| F1.1 | 21–24 jul 2026 | 4 días | Persistencia, permisos, zona horaria, aislamiento y errores de escritura. |
| F1.2 | 27–31 jul 2026 | 5 días | Horarios con múltiples franjas, bloqueos y tope diario probados. |
| F1.3 | 3–7 ago 2026 | 5 días | Reserva pública móvil, campaña y datos Meta de match. |
| F1.4 | 10–14 ago 2026 | 5 días | Bandeja diaria, asistencia/no asistencia y CRM básico. |
| F1.5 | 17–20 ago 2026 | 4 días | CAPI real, deduplicación, reintentos y Events Manager con cliente piloto. |
| F1.6 | 21 ago 2026 | 1 día | Aceptación, despliegue y enlace productivo del cliente piloto. |
| F2.1 | 24–28 ago 2026 | 5 días | Ingesta `ads_read` por cuenta asignada y aislamiento. |
| F2.2 | 31 ago–4 sep 2026 | 5 días | Cruce inversión/campaña con reservas y asistencias. |
| F2.3 | 7–11 sep 2026 | 5 días | Panel cliente sólo lectura, filtros y estados de datos. |
| F2.4 | 14–17 sep 2026 | 4 días | QA con cuenta real, criterios y endurecimiento. |
| F2.5 | 18 sep 2026 | 1 día | Entrega Fase 2, condicionada a aprobación efectiva de `ads_read`. |

Fecha de entrega Fase 1: **viernes 21 de agosto de 2026**.

Fecha objetivo Fase 2: **viernes 18 de septiembre de 2026**. Si Meta no aprueba `ads_read` a tiempo, el panel se entrega conectado a datos de prueba y la activación real ocurre dentro de los dos días hábiles posteriores a la aprobación, sin mover ni bloquear Fase 1.

## Aceptación de Fase 1

1. El cliente configura dos franjas en un mismo día, bloquea una fecha y una franja; ninguna opción bloqueada puede reservarse públicamente.
2. Al alcanzar el tope diario, no se generan más cupos ni se acepta una escritura concurrente adicional.
3. Una reserva real aparece en bandeja y CRM bajo el cliente correcto, con campaña y sin datos de otro cliente.
4. Events Manager recibe `Schedule` con datos de match; Pixel y CAPI comparten `event_id` y no duplican la conversión.
5. Al marcar asistencia, Events Manager recibe `Reserva_Asistida`; repetir la acción no duplica el evento.
6. Un evento pendiente se reintenta y puede procesarse dentro de siete días.
7. El token nunca llega al navegador ni a respuestas públicas y permanece cifrado en reposo.
8. Nico/equipo ejecutan los casos en Sprint Review; una pantalla mostrada no equivale a aceptación.

## Reviews y operación

- Avance breve diario en oficina o por el canal acordado, mostrando un caso pequeño ejecutable.
- Sprint Review oficial cada dos semanas: viernes 31 de julio, 14 de agosto, 28 de agosto y 11 de septiembre de 2026.
- Nico o un operador ejecuta los criterios; el resultado queda verde/rojo con evidencia.
- Defectos de un criterio comprometido se corrigen antes de abrir alcance nuevo.

## Business Verification y App Review

- **Nico / representante legal:** inicia y responde Business Verification porque Meta exige documentos y control legal del negocio. Inicio comprometido: 21 jul 2026.
- **Maxi:** prepara configuración técnica, política/URLs, video, pasos de revisión y solicitud `ads_read`. Envío comprometido: 24 jul 2026, siempre que Nico entregue acceso de administrador, activos y documentación a más tardar el 22 jul.
- CAPI con token del Pixel se construye y prueba en paralelo; no espera App Review.
- El estado administrativo se verifica en Meta App Dashboard y se conserva como evidencia; VitaHub no inventará un estado de aprobación.

## Propuesta comercial para enviar como tercero

Valores propuestos, sujetos a aceptación comercial y expresados netos:

- Fase 0 + Fase 1: **CLP $3.200.000 + IVA**.
- Fase 2: **CLP $1.600.000 + IVA**.
- Total Fases 0–2: **CLP $4.800.000 + IVA**.
- Pago: 40% al inicio, 30% al aprobar Fase 1 y 30% al aprobar Fase 2.
- Incluye desarrollo, pruebas, despliegue inicial, documentación, acompañamiento de App Review y 30 días de garantía por defectos.
- No incluye hosting/iHosting, dominio, cobros de Meta, diseño de campañas, carga histórica masiva, soporte evolutivo ni alcance fuera de fase.
- Cambios nuevos se cotizan aparte antes de iniciarlos. Las demoras por accesos o revisión externa desplazan sólo las actividades dependientes.

## Riesgos

- Falta de acceso a iHosting, Meta Business, Pixel o cuenta publicitaria impide pruebas/productivo reales.
- App Review no tiene plazo garantizable; por eso Fase 1 no depende de `ads_read`.
- Pixel/token incorrecto por cliente produciría contaminación de datos; se bloquea CAPI si falta asociación explícita.
- Cambiar `INTEGRATION_ENCRYPTION_KEY` vuelve ilegibles los tokens guardados.
- Cambios de DNS/SSL pueden tardar en propagarse.
- Mala calidad de teléfono/email reduce Event Match Quality aunque el transporte sea correcto.
- El enlace de Ads debe cambiar desde Google Form a VitaHub; sin ese cambio se pierde atribución.

## Diseño extensible de cuentas — incremento 20 jul 2026

- Las funciones contratadas se modelan como capacidades de empresa (`reservations`, `crm`, `metaConversions`) con valores predeterminados seguros. El catálogo es cerrado: agregar una futura función requiere declararla en el registro, evitando permisos inventados o inconsistentes.
- El alta y la edición permiten tres estados de Meta: sin Pixel, Pixel manual validado con token CAPI o reutilización explícita de un Pixel ya validado dentro de la misma organización.
- La empresa se crea antes de validar servicios externos. Si Meta rechaza la configuración, el alta queda reanudable desde Editar empresa y no se pierde la ficha.
- La configuración directa de Pixel/CAPI no depende de OAuth, Business Verification ni App Review. Una conexión OAuth posterior conserva las asociaciones CAPI existentes.
- Los formularios heredan capacidades y Pixel desde la empresa. La publicación bloquea CAPI si falta Pixel/token y genera un enlace con `utm_source=meta` y la referencia de campaña.
- Cloudinary valida las credenciales antes de persistirlas, conserva secretos al actualizar y asigna identificadores únicos a cada archivo.
