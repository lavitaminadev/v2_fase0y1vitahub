# VITAHUB Reservas

Estado: implementado y reutilizable como base de Fase 1. Requiere cierre de
alcance y validacion productiva antes de presentarse como entregado.

## Objetivo

Reservas es el nucleo operacional de Fase 1. Cada formulario pertenece a una
organizacion y a un cliente, publica un enlace propio y convierte visitas de
campanas en reservas, asistencia y resultado medible.

En esta fase no se presenta como sistema avanzado de restaurante ni como motor
de inventario. Su objetivo es capturar una reserva valida, respetar
disponibilidad y devolver conversiones utiles a Meta.

## Capacidades Prioritarias De Fase 1

- pagina publica mobile first
- campos minimos: nombre, telefono, email opcional, fecha, hora y personas
- horario semanal por cliente
- bloqueos por fecha completa y franja puntual
- tope diario de reservas
- atribucion UTM, `fbclid`, `_fbp` y `_fbc`
- prevencion de doble envio y validacion en servidor
- estados operacionales de reserva
- historial de cambios
- bandeja y calendario de reservas
- acciones de un clic para `asistio` y `no_asistio`

## Vista Del Cliente En Fase 1

La experiencia del cliente debe verse simple y enfocada.

Modulos visibles:

- Reservas
- Disponibilidad
- Bloqueos

Modulo opcional:

- Contactos, solo si se valida expresamente

El cliente no deberia navegar Fase 1 como un dashboard grande ni como un CRM
comercial. Debe entrar, configurar su disponibilidad y revisar su operacion.

## Integraciones

- CRM VITAHUB: crea o actualiza un contacto operacional idempotente desde la reserva.
- Meta CAPI: encola un evento `Schedule` persistente y reintenta sin bloquear la reserva.
- Meta asistencia: al marcar `asistio`, genera el segundo evento sin duplicados.
- Intake externo: debe poder reutilizar el mismo flujo de contacto + reserva desde formularios ajenos a VitaHub.
- Google Calendar y notificaciones existen como base tecnica, pero no lideran la presentacion de Fase 1.

Cada integracion se activa sin romper la reserva. Si una credencial externa falta
o el proveedor falla, la reserva se conserva y se agrega un evento
`integration_failed` al historial.

## Seguridad y datos

- todas las vistas internas usan organizacion y cliente como alcance obligatorio
- los usuarios cliente sin empresa asociada reciben acceso denegado, nunca acceso global
- la API publica no expone IDs internos, campanas ni configuracion sensible
- los endpoints publicos deben validar payload, disponibilidad e idempotencia en servidor
- los tokens de Meta se guardan cifrados

## Limites Explicitos

- no incluye mesas, salon, turnos ni capacidad por mesa
- no incluye pagos ni depositos
- no incluye WhatsApp/SMS automatico
- no incluye panel de metricas `ads_read`
- Google Calendar usa el calendario primario de la conexion de la organizacion
- la sincronizacion de conversiones offline de Google Ads queda fuera del foco inmediato
- facturacion continua fuera de alcance por decision de direccion

## Decision De Presentacion

Para presentar hoy, Reservas debe verse como:

- modulo ya existente y reutilizable
- centro de la operacion Fase 1
- origen de la conexion con CRM operacional
- base de las conversiones Meta por reserva y asistencia
