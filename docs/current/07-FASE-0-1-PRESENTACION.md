# Fase 0 Y Fase 1 - Cierre Para Presentacion

ESTADO: LISTO PARA PRESENTAR
FECHA: `2026-07-28`
ALCANCE: Fase 0 y Fase 1

## Objetivo De Esta Version

Dejar la propuesta alineada para presentar hoy, reutilizando lo ya construido y
reorganizando solo lo necesario para que Fase 0 y Fase 1 queden claras, acotadas
y ejecutables.

## 1. Reutilizacion Real Del Sistema Actual

La propuesta no parte desde cero. Se apoya en modulos existentes que ya cubren
gran parte del flujo base:

- `reservations`
- `reservation_forms`
- `reservation_events`
- `reservation_availability_blocks`
- `meta_conversion_outbox`
- `Lead` y `LeadIntakeService`
- autenticacion, roles y aislamiento por organizacion/cliente

## 2. Fase 0 Cerrada

Fase 0 se presenta como preparacion obligatoria y no como desarrollo difuso.

Incluye:

- dominio y HTTPS operativos
- validacion de despliegue productivo
- mapeo tecnico de entidades actuales reutilizables
- definicion de la relacion `clientId -> pixel/dataset -> token`
- inicio de Business Verification y App Review para `ads_read`

No incluye:

- panel de metricas para cliente
- reporteria avanzada
- automatizaciones comerciales

## 3. Fase 1 Cerrada

Fase 1 se presenta como MVP estricto para cerrar el circuito:

- pagina publica de reservas mobile first
- disponibilidad semanal
- bloqueos por fecha y franja
- tope diario
- bandeja de reservas
- marcar asistencia / no asistencia
- contactos de campanas conectados a reservas
- Pixel web por cliente
- CAPI de reserva y asistencia

No incluye:

- pipeline comercial completo
- panel `ads_read`
- pagos o depositos
- WhatsApp/SMS
- mesas, salon o turnos
- scoring o automatizaciones multietapa

## 4. Vista Del Cliente En Fase 1

La vista del cliente debe simplificarse y quedar centrada en operacion.

Modulos visibles recomendados:

- `Reservas`
- `Disponibilidad`
- `Bloqueos`

Modulo opcional solo si se valida:

- `Contactos`

No deberia ver en Fase 1:

- credenciales completas
- CRM comercial de agencia
- reporteria publicitaria avanzada
- configuraciones internas de soporte

## 5. CRM Ajustado A Lo Que Debe Hacer

En esta fase el CRM no se vende como pipeline.

Se presenta como:

- contactos de campanas por cliente
- vinculacion automatica con reservas
- estados simples: `nuevo`, `reservo`, `asistio`, `no_asistio`
- historial asociado a reservas

La reserva sigue siendo la fuente de verdad operacional.

## 6. Modulo Para Formularios Externos

Se deja definido un punto de extension para capturas fuera de VitaHub sin romper
la arquitectura de Fase 1.

### Propuesta

- endpoint: `POST /crm/intake/external`
- opcion de importacion estructurada por archivo CSV/JSON

### Uso

Sirve para:

- landing externa
- formulario embebido
- integracion puntual con otra fuente de captura

### Regla

Todo ingreso externo debe terminar en el mismo flujo:

- contacto operacional
- reserva si aplica
- asociacion por `clientId`
- trazabilidad de origen
- posibilidad de enviar a Meta solo cuando exista reserva valida

## 7. Mensaje De Presentacion Tecnica

Lo importante hoy es mostrar:

- que el sistema actual ya tiene base reutilizable
- que Fase 0 y Fase 1 estan acotadas
- que el CRM fue reenfocado a operacion real
- que la integracion con reservas y Meta es el centro
- que queda preparado un intake externo sin abrir alcance innecesario

## 8. Resultado Esperado

Con este ajuste, la propuesta queda mejor parada en cuatro niveles:

- funcional
- tecnico
- visual
- comercial

Y mantiene una base coherente para seguir creciendo despues sin tener que rehacer
el nucleo de reservas, contactos y conversiones.
