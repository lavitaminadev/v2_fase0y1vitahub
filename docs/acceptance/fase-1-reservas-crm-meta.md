# Sprint Review — aceptación de Fase 1

Operador: Nico o miembro designado del equipo. Cliente piloto y Pixel deben ser reales. Cada caso queda verde sólo con evidencia observable.

## Preparación

- `APP_PUBLIC_URL` y `API_PUBLIC_URL` HTTPS configurados.
- Migraciones aplicadas y health check correcto.
- Cliente piloto creado.
- Pixel y token CAPI asociados a ese cliente desde Integraciones.
- `META_TEST_EVENT_CODE` activo durante la prueba.
- Formulario publicado y enlace copiado desde VitaHub.

## Casos

1. Configurar martes 13:00–16:00 y 20:00–23:00. Confirmar que ambos rangos aparecen y el intervalo intermedio no.
2. Bloquear una fecha completa y una franja puntual. Actualizar la página pública y confirmar que desaparecen.
3. Fijar tope diario en 1, reservar una vez e intentar otra reserva. La segunda debe rechazarse aunque se envíe directamente al API.
4. Abrir el enlace con `utm_campaign`, `utm_source` y `fbclid`; reservar desde móvil. Confirmar reserva, campaña, `_fbc`/`_fbp`, IP y user agent en servidor.
5. Confirmar que la reserva y el contacto aparecen sólo bajo el cliente piloto.
6. Revisar Events Manager: `Schedule`, Pixel correcto, `event_id` estable, Browser + Server deduplicados y datos de match recibidos.
7. Marcar “Asistió”. Confirmar `Reserva_Asistida`. Repetir/refrescar y comprobar que no se duplica.
8. Simular fallo temporal de CAPI, comprobar estado `retry`, restablecer y procesar. Debe completar dentro de la ventana de siete días.
9. Ingresar como otro cliente e intentar consultar formulario, reservas y configuración. Todas las operaciones deben denegarse o devolver vacío.
10. Verificar que ninguna respuesta HTTP, HTML, bundle o log expone el token CAPI.

## Evidencia

Por caso: fecha, operador, URL/cliente, resultado esperado, resultado real, captura o ID técnico y estado verde/rojo. Los rojos bloquean la aceptación de Fase 1.
