-- Detección de datos comerciales generados por reservas.
--
-- Solo lectura: ninguna consulta modifica ni borra nada. El objetivo es dimensionar el alcance
-- del defecto corregido en `lead-intake.service.ts` y `crm-lead-automation.service.ts`, donde una
-- reserva de mesa entraba al embudo comercial y podía abrir una oportunidad de venta.
--
-- Uso:
--   mysql -u USUARIO -p BASE < scripts/local/audit-audience-leaks.sql
--
-- Las filas que devuelva la consulta 2 son oportunidades que ningún ejecutivo creó y que están
-- inflando el forecast. Revisarlas antes de decidir qué hacer con ellas: no borrar a ciegas,
-- porque una empresa prospecto real pudo además reservar mesa y compartir identificador.

-- 1. Cuántos leads provienen de reservas, y en qué estado quedaron.
SELECT
  'leads_desde_reservas' AS reporte,
  fit_status,
  status,
  COUNT(*) AS total,
  MIN(created_at) AS primero,
  MAX(created_at) AS ultimo
FROM crm_leads
WHERE source = 'vitahub_reservations'
GROUP BY fit_status, status
ORDER BY total DESC;

-- 2. Oportunidades comerciales abiertas a partir de un lead de reserva.
--    Estas son las que contaminan el pipeline: revisar una por una.
SELECT
  'oportunidades_contaminadas' AS reporte,
  o.id            AS oportunidad_id,
  o.name          AS oportunidad,
  o.stage,
  o.probability,
  o.amount,
  o.assigned_to,
  o.created_at,
  l.id            AS lead_id,
  l.name          AS comensal,
  l.client_id     AS cuenta,
  l.quality_score,
  l.metadata->>'$.reservationId' AS reserva_id
FROM crm_opportunities o
INNER JOIN crm_leads l ON l.id = o.lead_id
WHERE l.source = 'vitahub_reservations'
ORDER BY o.created_at DESC;

-- 3. Total y valor agregado del ruido, para saber cuánto se corrige el forecast.
SELECT
  'impacto_forecast' AS reporte,
  COUNT(*)                                   AS oportunidades,
  COALESCE(SUM(o.amount), 0)                 AS monto_bruto,
  COALESCE(SUM(o.amount * o.probability / 100), 0) AS monto_ponderado
FROM crm_opportunities o
INNER JOIN crm_leads l ON l.id = o.lead_id
WHERE l.source = 'vitahub_reservations';

-- 4. Actividad comercial generada automáticamente por reservas.
SELECT
  'actividad_contaminada' AS reporte,
  i.type,
  COUNT(*) AS total
FROM crm_interactions i
INNER JOIN crm_leads l ON l.id = i.lead_id
WHERE l.source = 'vitahub_reservations'
GROUP BY i.type
ORDER BY total DESC;

-- 5. Comensales que reservaron y nunca llegaron a la audiencia, porque el contacto solo se creaba
--    cuando el scoring comercial los calificaba. Son las filas que la corrección deja de perder
--    de ahora en adelante; las históricas se pueden reconstruir desde acá.
SELECT
  'comensales_sin_contacto' AS reporte,
  COUNT(*) AS total
FROM crm_leads l
LEFT JOIN crm_contacts c ON c.lead_id = l.id
WHERE l.source = 'vitahub_reservations'
  AND c.id IS NULL;

-- 6. Contactos de audiencia sin separación por cuenta.
--    `crm_contacts` no tiene `client_id`: hasta que se agregue, los comensales de todos los
--    restaurantes conviven en la misma tabla. Esta consulta muestra a cuántas cuentas
--    corresponden en realidad, derivándolo del lead de origen.
SELECT
  'contactos_por_cuenta' AS reporte,
  l.client_id AS cuenta,
  COUNT(*)    AS contactos
FROM crm_contacts c
INNER JOIN crm_leads l ON l.id = c.lead_id
WHERE l.source = 'vitahub_reservations'
GROUP BY l.client_id
ORDER BY contactos DESC;
