# Meta — Business Verification y App Review

## Responsables y fechas

| Acción | Responsable | Fecha |
|---|---|---|
| Crear/confirmar usuario Maxi en iHosting | Maxi | 21 jul 2026 |
| Autorizar a Maxi en servidor/Meta Business | Nico | 21–22 jul 2026 |
| Iniciar Business Verification y cargar documentos legales | Nico / representante legal | 21 jul 2026 |
| Configurar URLs, política, eliminación de datos y activos de prueba | Maxi | 21–23 jul 2026 |
| Grabar evidencia y preparar instrucciones al revisor | Maxi | 23 jul 2026 |
| Enviar App Review para `ads_read` | Maxi | 24 jul 2026 |
| Responder observaciones legales/comerciales | Nico | Dentro de 1 día hábil |
| Responder observaciones técnicas | Maxi | Dentro de 1 día hábil |

## Documentos que debe entregar Nico

- Razón social, dirección, teléfono y sitio web coherentes.
- Documento legal de constitución y comprobante de dirección/teléfono aceptado por Meta.
- Acceso administrador a Business Portfolio, App, Pixel y cuenta publicitaria piloto.
- Identificación del cliente piloto, cuenta publicitaria y Pixel autorizados.
- Confirmación de política de privacidad y persona de contacto.

## Evidencia que prepara Maxi

- Dominio HTTPS y rutas públicas estables.
- Política de privacidad y eliminación de datos accesibles.
- Usuario de revisión y pasos reproducibles.
- Video: conectar Meta, asignar cuenta a cliente y abrir panel sólo lectura.
- Llamada exitosa de `ads_read` con cuenta de prueba.
- Justificación de uso limitado: lectura para reporting, sin escritura ni optimización de campañas.

## CAPI no espera revisión

El onboarding de cada cliente registra Pixel y token de servidor cifrado. Se valida el Pixel y se ejecutan eventos de prueba en Events Manager. VitaHub no solicita `ads_management` ni `pages_manage_ads`.

## Evidencia de cierre

Guardar en el repositorio privado o gestor documental: fecha/hora del envío, permisos solicitados, video enviado, capturas del estado, observaciones y respuestas. El sistema no debe mostrar “aprobado” hasta confirmarlo directamente en Meta App Dashboard.
