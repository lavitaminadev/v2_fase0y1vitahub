-- VITAHUB local demonstration data.
-- Safe to run more than once because every record uses a stable identifier.

SET NAMES utf8mb4;
SET @org = '11111111-1111-4111-8111-111111111111';
SET @admin = '20000000-0000-4000-8000-000000000001';
SET @operations = '20000000-0000-4000-8000-000000000002';
SET @designer = '20000000-0000-4000-8000-000000000003';
SET @community = '20000000-0000-4000-8000-000000000004';
SET @client_user = '20000000-0000-4000-8000-000000000005';
SET @client_a = '30000000-0000-4000-8000-000000000001';
SET @client_b = '30000000-0000-4000-8000-000000000002';
SET @piece_a = '50000000-0000-4000-8000-000000000001';
SET @piece_b = '50000000-0000-4000-8000-000000000002';
SET @piece_c = '50000000-0000-4000-8000-000000000003';
SET @piece_d = '50000000-0000-4000-8000-000000000004';
SET @piece_e = '50000000-0000-4000-8000-000000000005';
SET @budget_a = '70000000-0000-4000-8000-000000000001';
SET @budget_b = '70000000-0000-4000-8000-000000000002';
SET @reservation_form = '90000000-0000-4000-8000-000000000001';

INSERT IGNORE INTO organizations
  (id, name, code, currency, is_active, created_at, updated_at)
VALUES
  (@org, 'La Vitamina', 'VITLOCAL', 'CLP', 1, NOW(), NOW());

-- Passwords: AdminLocal_2026!, EquipoLocal_2026!, ClienteLocal_2026!
INSERT IGNORE INTO users
  (id, organization_id, name, email, password, role, is_active, created_at, updated_at)
VALUES
  (@admin, @org, 'Administracion Vitamina', 'admin@vitahub.local', '$2a$10$rGJZUkmqYoVCZapOY2tU8OutaK4viMIMWh9S8PuvSKBsp7.8SePIu', 'admin', 1, NOW(), NOW()),
  (@operations, @org, 'Camila Operaciones', 'operaciones@vitahub.local', '$2a$10$PllHKCR6UuLqDAGks0BEoeeYRUPJ7dzfVPm9A/2WW4hcNxtxmODRa', 'operations_director', 1, NOW(), NOW()),
  (@designer, @org, 'Tomas Diseno', 'diseno@vitahub.local', '$2a$10$PllHKCR6UuLqDAGks0BEoeeYRUPJ7dzfVPm9A/2WW4hcNxtxmODRa', 'designer', 1, NOW(), NOW()),
  (@community, @org, 'Sofia Cuentas', 'cuentas@vitahub.local', '$2a$10$PllHKCR6UuLqDAGks0BEoeeYRUPJ7dzfVPm9A/2WW4hcNxtxmODRa', 'community_manager', 1, NOW(), NOW());

INSERT IGNORE INTO clients
  (id, organization_id, community_manager_id, name, legal_name, industry, status, retainer_amount, currency, started_at, renewal_at, default_ud_budget, created_at, updated_at)
VALUES
  (@client_a, @org, @community, 'Casa Nativa', 'Casa Nativa SpA', 'Gastronomia', 'active', 1250000, 'CLP', DATE_SUB(CURDATE(), INTERVAL 8 MONTH), DATE_ADD(CURDATE(), INTERVAL 4 MONTH), 28, NOW(), NOW()),
  (@client_b, @org, @community, 'Clinica Horizonte', 'Salud Horizonte Ltda.', 'Salud', 'active', 1680000, 'CLP', DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 7 MONTH), 36, NOW(), NOW());

INSERT IGNORE INTO users
  (id, organization_id, client_id, name, email, password, role, is_active, created_at, updated_at)
VALUES
  (@client_user, @org, @client_a, 'Valentina Casa Nativa', 'cliente@vitahub.local', '$2a$10$rJiFGKQ4ZNKBhMbo.XDYnO5Kl1U2uzTzZS3m0AXbpBtZTJbbcYovC', 'client', 1, NOW(), NOW());

INSERT IGNORE INTO leads
  (id, organization_id, name, email, phone, company, source, source_detail, status, assigned_to, notes, fit_status, quality_score, campaign_name, consent_captured_at, metadata, created_at, updated_at)
VALUES
  ('40000000-0000-4000-8000-000000000001', @org, 'Martina Rojas', 'martina@surstudio.cl', '+56955551001', 'Sur Studio', 'meta_lead_ads', 'Formulario servicios agencia', 'new', @community, 'Solicita propuesta de lanzamiento.', 'qualified', 86, 'Prospeccion Invierno', NOW(), JSON_OBJECT('ad', 'video_01', 'city', 'Santiago'), DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  ('40000000-0000-4000-8000-000000000002', @org, 'Diego Valdes', 'diego@tiendaverde.cl', '+56955551002', 'Tienda Verde', 'referral', 'Referido por cliente', 'meeting_scheduled', @community, 'Reunion agendada para revisar ecommerce.', 'qualified', 78, NULL, NOW(), JSON_OBJECT('referrer', 'Casa Nativa'), DATE_SUB(NOW(), INTERVAL 8 DAY), NOW()),
  ('40000000-0000-4000-8000-000000000003', @org, 'Paula Contreras', 'paula@fundacionuno.cl', '+56955551003', 'Fundacion Uno', 'website', 'Formulario contacto web', 'quote_sent', @community, 'Propuesta enviada y en evaluacion.', 'review', 63, 'Inbound Sitio', NOW(), JSON_OBJECT('interest', 'contenido'), DATE_SUB(NOW(), INTERVAL 14 DAY), NOW());

INSERT IGNORE INTO contracts
  (id, organization_id, client_id, name, service_type, start_date, end_date, monthly_ud, status, terms, created_at, updated_at)
VALUES
  ('61000000-0000-4000-8000-000000000001', @org, @client_a, 'Plan Contenido Casa Nativa', 'Social media integral', DATE_SUB(CURDATE(), INTERVAL 8 MONTH), DATE_ADD(CURDATE(), INTERVAL 4 MONTH), 28, 'active', 'Plan mensual con estrategia, produccion y reporte.', NOW(), NOW()),
  ('61000000-0000-4000-8000-000000000002', @org, @client_b, 'Plan Performance Horizonte', 'Contenido y performance', DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 7 MONTH), 36, 'active', 'Contenido, campanas y seguimiento de conversiones.', NOW(), NOW());

INSERT IGNORE INTO pieces
  (id, organization_id, client_id, assigned_to, type, title, status, difficulty_level, ud_amount, deadline_at, delivered_at, correction_count, client_correction_count, description, created_at, updated_at)
VALUES
  (@piece_a, @org, @client_a, @designer, 'carousel', 'Menu de temporada', 'in_progress', 3, 2.20, DATE_ADD(NOW(), INTERVAL 3 DAY), NULL, 0, 0, 'Carrusel editorial para el nuevo menu.', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
  (@piece_b, @org, @client_a, @designer, 'story_original', 'Historias fin de semana', 'client_validation', 2, 0.80, DATE_ADD(NOW(), INTERVAL 1 DAY), NULL, 1, 1, 'Secuencia de historias con reserva directa.', DATE_SUB(NOW(), INTERVAL 6 DAY), NOW()),
  (@piece_c, @org, @client_b, @designer, 'post_author', 'Consejos preventivos', 'assigned', 2, 1.50, DATE_ADD(NOW(), INTERVAL 5 DAY), NULL, 0, 0, 'Post educativo firmado por especialista.', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  (@piece_d, @org, @client_b, @designer, 'carousel', 'Campana chequeo anual', 'delivered', 3, 2.20, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 0, 'Campana entregada y aprobada.', DATE_SUB(NOW(), INTERVAL 15 DAY), NOW()),
  (@piece_e, @org, @client_a, NULL, 'reel_cover', 'Portada reel cocina abierta', 'backlog', 1, 0.30, DATE_ADD(NOW(), INTERVAL 8 DAY), NULL, 0, 0, 'Pendiente de asignacion.', NOW(), NOW());

INSERT IGNORE INTO approval_requests
  (id, organization_id, client_id, title, description, entity_type, entity_id, requested_by, assigned_to, status, due_at, created_at, updated_at)
VALUES
  ('62000000-0000-4000-8000-000000000001', @org, @client_a, 'Aprobar historias fin de semana', 'Revision de copy, precios y llamado a reservar.', 'piece', @piece_b, @community, @client_user, 'pending', DATE_ADD(NOW(), INTERVAL 1 DAY), NOW(), NOW()),
  ('62000000-0000-4000-8000-000000000002', @org, @client_b, 'Campana chequeo anual', 'Aprobacion registrada para mostrar trazabilidad.', 'piece', @piece_d, @community, NULL, 'approved', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), NOW());

INSERT IGNORE INTO meetings
  (id, organization_id, client_id, title, type, status, scheduled_at, duration_minutes, location, meeting_link, created_by, minutes, created_at, updated_at)
VALUES
  ('63000000-0000-4000-8000-000000000001', @org, @client_a, 'Revision semanal Casa Nativa', 'weekly', 'scheduled', DATE_ADD(NOW(), INTERVAL 2 DAY), 45, 'Google Meet', 'https://meet.google.com/demo-casa-nativa', @community, NULL, NOW(), NOW()),
  ('63000000-0000-4000-8000-000000000002', @org, @client_b, 'Comite estrategico Horizonte', 'strategic', 'completed', DATE_SUB(NOW(), INTERVAL 4 DAY), 60, 'Oficina cliente', NULL, @operations, 'Se priorizo campana preventiva y agenda online.', DATE_SUB(NOW(), INTERVAL 10 DAY), NOW());

INSERT IGNORE INTO content_grids
  (id, organization_id, client_id, title, week_start, week_end, status, notes, created_at, updated_at)
VALUES
  ('64000000-0000-4000-8000-000000000001', @org, @client_a, 'Grilla Casa Nativa - Semana actual', DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY), 'submitted', 'Pendiente de validacion de dos copys.', NOW(), NOW()),
  ('64000000-0000-4000-8000-000000000002', @org, @client_b, 'Grilla Horizonte - Semana actual', DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY), 'approved', 'Grilla aprobada para produccion.', NOW(), NOW());

INSERT IGNORE INTO content_items
  (id, content_grid_id, type, caption, status, scheduled_at, piece_id, notes, created_at, updated_at)
VALUES
  ('65000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 'carousel', 'Descubre nuestro menu de temporada', 'in_production', DATE_ADD(CURDATE(), INTERVAL 2 DAY), @piece_a, 'Usar fotografia principal aprobada.', NOW(), NOW()),
  ('65000000-0000-4000-8000-000000000002', '64000000-0000-4000-8000-000000000001', 'story', 'Reserva tu mesa para este fin de semana', 'completed', DATE_ADD(CURDATE(), INTERVAL 1 DAY), @piece_b, NULL, NOW(), NOW()),
  ('65000000-0000-4000-8000-000000000003', '64000000-0000-4000-8000-000000000002', 'carousel', 'Tu chequeo anual importa', 'completed', DATE_SUB(CURDATE(), INTERVAL 2 DAY), @piece_d, NULL, NOW(), NOW());

INSERT IGNORE INTO ud_budgets
  (id, client_id, year, month, contracted, reserved, consumed, status, created_at, updated_at)
VALUES
  (@budget_a, @client_a, YEAR(CURDATE()), MONTH(CURDATE()), 28, 3.30, 12.40, 'open', NOW(), NOW()),
  (@budget_b, @client_b, YEAR(CURDATE()), MONTH(CURDATE()), 36, 1.50, 18.70, 'open', NOW(), NOW());

INSERT IGNORE INTO ud_movements
  (id, ud_budget_id, piece_id, type, amount, reason, actor_id, created_at, updated_at)
VALUES
  ('71000000-0000-4000-8000-000000000001', @budget_a, @piece_a, 'reservation', 2.20, 'Reserva para pieza en produccion', @operations, DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
  ('71000000-0000-4000-8000-000000000002', @budget_b, @piece_d, 'consumption', 2.20, 'Consumo confirmado al entregar', @operations, DATE_SUB(NOW(), INTERVAL 2 DAY), NOW());

INSERT IGNORE INTO account_cycles
  (id, organization_id, client_id, year, month, status, grid_status, production_status, weekly_meetings_due, weekly_meetings_completed, strategy_meeting_status, report_status, started_at, ends_at, created_at, updated_at)
VALUES
  ('72000000-0000-4000-8000-000000000001', @org, @client_a, YEAR(CURDATE()), MONTH(CURDATE()), 'active', 'in_progress', 'in_progress', 4, 2, 'completed', 'pending', DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), NOW(), NOW()),
  ('72000000-0000-4000-8000-000000000002', @org, @client_b, YEAR(CURDATE()), MONTH(CURDATE()), 'active', 'completed', 'in_progress', 4, 3, 'completed', 'in_progress', DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), NOW(), NOW());

INSERT IGNORE INTO objectives
  (id, organization_id, owner_id, client_id, category, title, description, status, progress, due_at, created_by, created_at, updated_at)
VALUES
  ('73000000-0000-4000-8000-000000000001', @org, @operations, NULL, 'operaciones', 'Cerrar ciclos antes del ultimo dia habil', 'Completar grillas, produccion, reuniones y reportes.', 'active', 60, LAST_DAY(CURDATE()), @admin, NOW(), NOW()),
  ('73000000-0000-4000-8000-000000000002', @org, @community, @client_a, 'cuentas', 'Reducir tiempos de aprobacion', 'Lograr respuestas del cliente en menos de 48 horas.', 'active', 40, DATE_ADD(CURDATE(), INTERVAL 21 DAY), @admin, NOW(), NOW());

INSERT IGNORE INTO xp_periods
  (id, organization_id, user_id, week_start, week_end, total_xp, tier, status, created_at, updated_at)
VALUES
  ('74000000-0000-4000-8000-000000000001', @org, @designer, DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY), 180, 'silver', 'open', NOW(), NOW());

INSERT IGNORE INTO xp_events
  (id, xp_period_id, user_id, piece_id, event_type, points, description, metadata, created_at, updated_at)
VALUES
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', @designer, @piece_d, 'piece_delivered', 120, 'Entrega a tiempo', JSON_OBJECT('source', 'seed'), DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000001', @designer, @piece_d, 'quality_bonus', 60, 'Bono por aprobacion con una correccion', JSON_OBJECT('source', 'seed'), DATE_SUB(NOW(), INTERVAL 1 DAY), NOW());

INSERT IGNORE INTO briefs
  (id, organization_id, client_id, title, description, requirements, status, due_date, created_at, updated_at)
VALUES
  ('76000000-0000-4000-8000-000000000001', @org, @client_a, 'Campana cocina abierta', 'Mostrar el proceso y al equipo de cocina.', JSON_OBJECT('formats', JSON_ARRAY('reel', 'stories'), 'tone', 'cercano'), 'approved', DATE_ADD(CURDATE(), INTERVAL 12 DAY), NOW(), NOW()),
  ('76000000-0000-4000-8000-000000000002', @org, @client_b, 'Mes de la prevencion', 'Plan educativo con especialistas.', JSON_OBJECT('formats', JSON_ARRAY('carousel', 'video'), 'compliance', true), 'draft', DATE_ADD(CURDATE(), INTERVAL 18 DAY), NOW(), NOW());

INSERT IGNORE INTO services
  (id, organization_id, name, description, category, unit_price, currency, ud_per_unit, status, created_at, updated_at)
VALUES
  ('77000000-0000-4000-8000-000000000001', @org, 'Post simple', 'Pieza estatica para feed.', 'design', 50000, 'CLP', 1.00, 'active', NOW(), NOW()),
  ('77000000-0000-4000-8000-000000000002', @org, 'Carrusel editorial', 'Carrusel de hasta seis laminas.', 'design', 110000, 'CLP', 2.20, 'active', NOW(), NOW()),
  ('77000000-0000-4000-8000-000000000003', @org, 'Reel producido', 'Grabacion y edicion de reel.', 'audiovisual', 240000, 'CLP', 4.50, 'active', NOW(), NOW());

INSERT IGNORE INTO invoices
  (id, organization_id, client_id, number, issued_at, due_at, paid_at, subtotal, tax, total, currency, status, notes, created_at, updated_at)
VALUES
  ('78000000-0000-4000-8000-000000000001', @org, @client_a, 'LOCAL-1001', DATE_SUB(CURDATE(), INTERVAL 35 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 22 DAY), 1050420, 199580, 1250000, 'CLP', 'paid', 'Dato demostrativo; no representa facturacion integrada.', DATE_SUB(NOW(), INTERVAL 35 DAY), NOW()),
  ('78000000-0000-4000-8000-000000000002', @org, @client_b, 'LOCAL-1002', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), NULL, 1411765, 268235, 1680000, 'CLP', 'pending', 'Dato demostrativo; facturacion permanece fuera del alcance.', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW());

INSERT IGNORE INTO integration_metrics
  (id, organization_id, client_id, provider, external_account_id, metric_date, spend, impressions, reach, clicks, conversions, leads, breakdown, created_at, updated_at)
VALUES
  ('79000000-0000-4000-8000-000000000001', @org, @client_a, 'meta', 'demo-meta-casa', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 185000, 124000, 87000, 3460, 94, 126, JSON_OBJECT('demo', true), NOW(), NOW()),
  ('79000000-0000-4000-8000-000000000002', @org, @client_a, 'google_ads', 'demo-google-casa', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 92000, 38000, 31000, 1840, 48, 61, JSON_OBJECT('demo', true), NOW(), NOW()),
  ('79000000-0000-4000-8000-000000000003', @org, @client_b, 'meta', 'demo-meta-horizonte', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 245000, 156000, 111000, 4280, 132, 175, JSON_OBJECT('demo', true), NOW(), NOW());

INSERT IGNORE INTO reservation_forms
  (id, organization_id, client_id, name, public_slug, status, mode, timezone, duration_minutes, buffer_minutes, capacity_per_slot, minimum_notice_hours, maximum_advance_days, confirmation_mode, field_schema, design_config, schedule_config, services_config, resources_config, campaign_id, created_by, crm_enabled, calendar_enabled, meta_capi_enabled, created_at, updated_at)
VALUES
  (@reservation_form, @org, @client_a, 'Reservas Casa Nativa', 'casa-nativa-demo', 'published', 'appointment', 'America/Santiago', 60, 15, 4, 2, 45, 'automatic',
   JSON_ARRAY(
     JSON_OBJECT('id', 'name', 'type', 'text', 'label', 'Nombre completo', 'required', true, 'system', true),
     JSON_OBJECT('id', 'email', 'type', 'email', 'label', 'Correo', 'required', false, 'system', true),
     JSON_OBJECT('id', 'phone', 'type', 'phone', 'label', 'Telefono', 'required', true, 'system', true),
     JSON_OBJECT('id', 'occasion', 'type', 'select', 'label', 'Motivo de la visita', 'required', false, 'options', JSON_ARRAY('Almuerzo', 'Celebracion', 'Reunion')),
     JSON_OBJECT('id', 'consent', 'type', 'consent', 'label', 'Acepto el tratamiento de mis datos para gestionar la reserva.', 'required', true)
   ),
   JSON_OBJECT('primaryColor', '#173f35', 'accentColor', '#bd4527', 'backgroundColor', '#f3f5ef', 'title', 'Reserva tu mesa', 'welcome', 'Elige el horario que mejor te acomode.'),
   JSON_OBJECT('windows', JSON_ARRAY(
     JSON_OBJECT('day', 1, 'start', '12:00', 'end', '21:00'), JSON_OBJECT('day', 2, 'start', '12:00', 'end', '21:00'),
     JSON_OBJECT('day', 3, 'start', '12:00', 'end', '21:00'), JSON_OBJECT('day', 4, 'start', '12:00', 'end', '21:00'),
     JSON_OBJECT('day', 5, 'start', '12:00', 'end', '22:00'), JSON_OBJECT('day', 6, 'start', '12:00', 'end', '22:00')
   )),
   JSON_ARRAY(JSON_OBJECT('id', 'almuerzo', 'name', 'Reserva restaurante', 'durationMinutes', 60, 'capacity', 4)),
   JSON_ARRAY(JSON_OBJECT('id', 'salon', 'name', 'Salon principal', 'capacity', 4), JSON_OBJECT('id', 'terraza', 'name', 'Terraza', 'capacity', 4)),
   'demo_reservas_local', @admin, 1, 0, 0, NOW(), NOW());

INSERT IGNORE INTO reservations
  (id, organization_id, client_id, form_id, reference_code, status, starts_at, ends_at, party_size, service_id, resource_id, guest_name, guest_email, guest_phone, answers, consent_version, internal_notes, utm_source, utm_medium, utm_campaign, created_at, updated_at)
VALUES
  ('91000000-0000-4000-8000-000000000001', @org, @client_a, @reservation_form, 'VIT-DEMO-01', 'confirmed', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 13 HOUR, DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 14 HOUR, 2, 'almuerzo', 'salon', 'Daniela Soto', 'daniela@example.com', '+56955552001', JSON_OBJECT('occasion', 'Almuerzo'), 'v1', 'Confirmar mesa junto a ventana.', 'instagram', 'social', 'demo_reservas_local', NOW(), NOW()),
  ('91000000-0000-4000-8000-000000000002', @org, @client_a, @reservation_form, 'VIT-DEMO-02', 'attended', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL 20 HOUR, DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL 21 HOUR, 4, 'almuerzo', 'terraza', 'Felipe Munoz', 'felipe@example.com', '+56955552002', JSON_OBJECT('occasion', 'Celebracion'), 'v1', NULL, 'google', 'cpc', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 7 DAY), NOW());

INSERT IGNORE INTO reservation_events
  (id, organization_id, client_id, reservation_id, type, from_status, to_status, actor_id, actor_type, metadata, created_at)
VALUES
  ('92000000-0000-4000-8000-000000000001', @org, @client_a, '91000000-0000-4000-8000-000000000001', 'created', NULL, 'confirmed', NULL, 'guest', JSON_OBJECT('source', 'public_form'), NOW()),
  ('92000000-0000-4000-8000-000000000002', @org, @client_a, '91000000-0000-4000-8000-000000000002', 'status_changed', 'confirmed', 'attended', @community, 'user', JSON_OBJECT('source', 'internal'), NOW());

INSERT IGNORE INTO reservation_form_events
  (id, organization_id, client_id, form_id, type, session_id, utm_source, utm_campaign, created_at)
VALUES
  ('93000000-0000-4000-8000-000000000001', @org, @client_a, @reservation_form, 'view', 'demo-session-1', 'instagram', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  ('93000000-0000-4000-8000-000000000002', @org, @client_a, @reservation_form, 'start', 'demo-session-2', 'google', 'demo_reservas_local', NOW()),
  ('93000000-0000-4000-8000-000000000003', @org, @client_a, @reservation_form, 'view', 'demo-session-2', 'google', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 12 HOUR)),
  ('93000000-0000-4000-8000-000000000004', @org, @client_a, @reservation_form, 'view', 'demo-session-3', 'instagram', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 8 HOUR)),
  ('93000000-0000-4000-8000-000000000005', @org, @client_a, @reservation_form, 'start', 'demo-session-3', 'instagram', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 7 HOUR)),
  ('93000000-0000-4000-8000-000000000006', @org, @client_a, @reservation_form, 'view', 'demo-session-4', 'direct', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
  ('93000000-0000-4000-8000-000000000007', @org, @client_a, @reservation_form, 'start', 'demo-session-4', 'direct', 'demo_reservas_local', DATE_SUB(NOW(), INTERVAL 3 HOUR));

INSERT IGNORE INTO notifications
  (id, organization_id, user_id, type, title, message, data, `read`, created_at)
VALUES
  ('94000000-0000-4000-8000-000000000001', @org, @admin, 'deadline_approaching', 'Pieza proxima a vencer', 'Historias fin de semana vence manana.', JSON_OBJECT('pieceId', @piece_b), 0, NOW()),
  ('94000000-0000-4000-8000-000000000002', @org, @designer, 'piece_assigned', 'Nueva pieza asignada', 'Consejos preventivos fue asignada a tu cola.', JSON_OBJECT('pieceId', @piece_c), 0, NOW());

SELECT 'VITAHUB demo data ready' AS result;
