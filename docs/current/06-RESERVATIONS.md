# VITAHUB Reservas

Estado: implementado y operativo en código. Requiere migraciones `0017` y `0018` antes de usarlo en producción.

## Objetivo

Reservas es una subsección independiente y multiempresa. Cada formulario pertenece a una organización y a un cliente, publica un enlace propio y convierte visitas de campañas en reservas, asistencia y resultado medible. Complementa la reportería central definida en el Documento Maestro.

## Capacidades

- Constructor guiado con campos editables, clic, arrastre y controles de orden accesibles.
- Diseño por formulario: título, bienvenida, colores y fondo HTTPS.
- Servicios con duración/capacidad propia y recursos como profesional, sede, box, mesa o equipo.
- Horario semanal, zona horaria IANA, separación entre citas, aviso mínimo, ventana máxima y bloqueos.
- Enlaces públicos ilimitados por cliente y formulario.
- Atribución UTM, `gclid`/`fbclid`, campaña asociada y embudo visita -> inicio -> reserva.
- Prevención de doble envío, sobrecupo, horarios inventados y confirmaciones inválidas de lista de espera.
- Estados controlados, reagendamiento validado e historial de quién cambió qué y cuándo.
- Lista con filtros, búsqueda diferida, paginación y exportación CSV de hasta 10.000 registros.
- Dashboard de conversión, demanda horaria, asistencia, cancelación, no-show, fuente y campaña.
- Portal cliente limitado a sus formularios, bloqueos, reservas y métricas.

## Integraciones

- CRM VITAHUB: crea o actualiza un lead idempotente desde la reserva.
- Google Calendar: crea el evento y renueva automáticamente el token OAuth si está por expirar.
- Meta CAPI: encola un evento `Schedule` persistente y reintenta sin bloquear la reserva.
- Notificaciones: avisa al CM asignado y a usuarios cliente vinculados a la empresa.

Cada integración se activa por formulario. Si una credencial externa falta o el proveedor falla, la reserva se conserva y se agrega un evento `integration_failed` al historial.

## Seguridad y datos

- Todas las vistas internas usan organización y cliente como alcance obligatorio.
- Los usuarios cliente sin empresa asociada reciben acceso denegado, nunca acceso global.
- La API pública no expone IDs internos, campañas ni configuración de integración.
- Los esquemas, opciones, colores, URLs, respuestas, servicios, recursos y zonas horarias se validan en servidor.
- Los endpoints públicos tienen límite de tasa, honeypot, tiempo mínimo de envío e idempotencia.
- Los tokens de Meta y Google se guardan cifrados con `INTEGRATION_ENCRYPTION_KEY`.

## Límites explícitos

- El correo/SMS/WhatsApp de confirmación necesita elegir proveedor; no se simula un envío inexistente.
- Google Calendar usa el calendario primario de la conexión de la organización.
- La sincronización de conversiones offline de Google Ads requiere definir la acción de conversión por cuenta; las reservas ya conservan `gclid` y UTM para ese paso.
- Facturación continúa fuera de alcance por decisión de dirección.

## Despliegue

1. Desplegar el código.
2. Ejecutar `npm run migration:run` desde la raíz del repositorio.
3. Confirmar que se aplicaron `Reservations1710000000017` y `ReservationsHardening1710000000018`.
4. Reiniciar Passenger.
5. Crear un formulario de prueba, publicar, reservar y verificar CRM/Calendar/Meta según los interruptores activos.

