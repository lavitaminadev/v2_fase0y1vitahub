# Decisiones de Negocio Pendientes

Estas decisiones deben ser resueltas por la dirección de La Vitamina antes de completar los módulos afectados.

| # | Decisión | Módulo Afectado | Impacto | Se Puede Avanzar |
|---|----------|-----------------|---------|-------------------|
| 1 | Esquema definitivo del Brief | briefs | No se puede construir formulario exacto | Sí — CRUD básico + campo JSON para flexibilidad |
| 2 | Producción audiovisual (niveles, tiempos, XP) | audiovisual | Módulo completo bloqueado | Sí — estructura preparada, propuesta en revisión |
| 3 | Regla de UD excedidas (bloqueo/aviso/cobro) | design-budget | Límite del presupuesto | Sí — tracking funciona, decisión sobre exceso |
| 4 | Visibilidad de saldo UD para cliente | portal-cliente | Lo que ve el cliente en portal | Sí — backend listo, UI pendiente |
| 5 | Métricas definitivas de CM y AV | gamification | Solo diseñadores tienen XP | Sí — estructura preparada para nuevos tipos |
| 6 | Proveedor de facturación electrónica | billing | Integración con SII/Bsale/Nubox | Sí — endpoints CRUD funcionan, integración externa pendiente |
| 7 | Modelo definitivo de pods | operations | Asignación por equipo vs individual | Sí — estructura preparada para ambos |
| 8 | Precios y catálogo comercial definitivo | catalog | Planes Esencial/Integral, Meta Ads, Google Ads | Sí — entidades listas, falta poblar valores |
| 9 | Reglas de reels adicionales | catalog/contracts | Cobro de reels sobre límite | Sí — contratos tienen campo reels_included |
| 10 | Detalles de aprobación del cliente (pieza vs grilla, tiempo tácito) | portal-cliente | UX del flujo de aprobación | Sí — backend approve/reject funciona |
| 11 | Costo interno por UD | design-budget | Rentabilidad por cliente | Sí — campo price disponible, falta definir |
| 12 | Renombre UD → Créditos de Diseño | design-budget | UI y comunicaciones | Sí — cambio de label solamente |
| 13 | Borrar un cliente: ¿soft-delete (archivar) o hard-delete real? | clients, billing | Hoy `DELETE /clients/:id` borra físico y arrastra en cascada facturas/pagos/reportes | Parcial — cambié las tablas financieras (`invoices`, `monthly_reports`) de `CASCADE` a `RESTRICT`: ya no se puede borrar un cliente con facturación asociada, hay que decidir qué hacer con ella primero. Falta decidir la política final (archivar vs. exigir cierre contable) |
| 14 | Retención/limpieza de datos huérfanos en `charge_notes`/`account_cycles` | billing, account-cycles | Estas tablas se crearon sin foreign keys; pueden tener filas apuntando a registros ya borrados | Parcial — migración defensiva que detecta huérfanos antes de agregar la constraint: si la base está limpia la aplica sola, si encuentra huérfanos los reporta en el log de migración y no rompe el deploy. Falta que alguien revise el reporte si aparecen huérfanos |
| 15 | Dónde y por cuánto tiempo guardar backups (¿local, S3, otro?) | infraestructura | Sin esto no hay backup automático real en producción | Parcial — conecté `backup.sh` (ya existía, no se usaba) a un cron diario que guarda localmente en el servidor. Falta decidir almacenamiento externo/retención — un backup que vive en el mismo servidor no protege ante falla de disco completa |
| 16 | Persistencia de la base de conocimiento (`KnowledgeStore`) | knowledge | Hoy vive 100% en memoria: se pierde en cada deploy/reinicio de Passenger | Aplicado — migré el store de un `Map` en memoria a una tabla real en MySQL. Ya no se pierde en cada deploy |
| 17 | Automatizar migraciones dentro de `.cpanel.yml` | infraestructura | Hoy es un paso manual explícito, decisión deliberada del equipo por seguridad | No aplica cambio — es la política ya elegida a propósito (evitar que un deploy corra con una migración a medio fallar sin que nadie lo note). Lo dejé así; si se quiere cambiar es decisión de riesgo, no un bug |
