# Alineacion con Documento Maestro

Fecha: 2026-07-16

## Ajustes aplicados en esta iteracion

- CRM Lead Ads con flujo real Meta -> webhook -> descarga -> normalizacion -> dedupe -> score -> oportunidad/interaccion.
- Webhook Meta accesible sin JWT pero protegido por firma, limite de tasa y timeout.
- Credenciales Meta cifradas en reposo y eliminadas de las respuestas de API.
- Pixel y prueba CAPI conectados al secreto del servidor, sin pegar tokens en el navegador.
- Callback formal de eliminacion de datos de Meta con `signed_request` verificado.
- Restriccion de vistas y rutas sensibles por rol usando manifests.
- Gestion de usuarios alineada a La Vitamina como operacion interna, con asignacion de empresa para cuentas cliente.
- Onboarding con checklist estandar derivado del flujo oficial del Maestro.
- Produccion con acciones de estado mas cercanas al flujo oficial y envio a validacion cliente generando aprobacion.
- Portal cliente de aprobaciones conectado al backend para aprobar o rechazar piezas reales.
- Reservas multiempresa con formularios públicos, disponibilidad real, trazabilidad, embudo de conversión y portal cliente.
- Reservas conectadas opcionalmente a CRM, Google Calendar, Meta CAPI y notificaciones internas sin acoplar la confirmación a la disponibilidad de terceros.

## Alineado y operativo

### CRM comercial

- lead con origen, score, fit status, descarte y trazabilidad
- oportunidades e interacciones basicas
- exportacion y anonimización para cumplimiento

### Produccion

- estados base del Maestro presentes en backend
- asignacion, inicio, revision interna, validacion cliente, aprobacion y entrega
- creacion de solicitudes de aprobacion al enviar al cliente

### Portal cliente

- acceso restringido a rol `client`
- aprobaciones pendientes visibles
- aprobacion y rechazo operables sobre solicitudes reales

### Onboarding

- pasos manuales CRUD
- plantilla estandar de checklist para no inventar secuencias por cliente

## Pendientes que siguen dependiendo de decision o desarrollo posterior

- brief definitivo de negocio
- modelo definitivo de pods y scoping por CM/cuenta
- audiovisual completo segun propuesta separada
- regla definitiva de cobro por 4ta correccion
- reporteria final con plataformas de reserva y CRM externo definidos
- proveedor definitivo de facturacion y cobranza
- politica juridica definitiva de retencion y ejercicio de derechos
- cifrado selectivo adicional para PII del CRM, distinto del cifrado ya aplicado a credenciales

## Regla aplicada

Cuando el Maestro deja una decision como pendiente, el codigo no la cierra de forma arbitraria. Se implementa el punto de extension y se documenta la brecha en lugar de endurecer una regla inventada.
