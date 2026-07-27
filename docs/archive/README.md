# Archivo — documentos históricos

Estos documentos fueron análisis, propuestas o auditorías de un momento puntual
(julio 2026). Se movieron aquí porque su contenido ya fue absorbido por las
fuentes de verdad vigentes y dejarlos en `docs/` generaba confusión sobre cuál
documento manda. No se borraron porque conservan valor como registro de por
qué se tomó cada decisión.

**Para el estado y plan actuales, usar:**

- [`tasks/plan.md`](../../tasks/plan.md) — plan comprometido por fases, cronograma, propuesta comercial vigente.
- [`tasks/todo.md`](../../tasks/todo.md) — tablero de entrega con estado real de cada ítem.
- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`docs/architecture/current.md`](../architecture/current.md) — arquitectura vigente.
- [`docs/current/`](../current/) — estado técnico verificado (`ESTADO: VIGENTE` en cada archivo).
- [`docs/deployment/ihosting.md`](../deployment/ihosting.md) — guía oficial de despliegue.

## Contenido

| Archivo | Qué era | Por qué se archivó |
|---|---|---|
| `gap-analysis-vs-maestro.md` | Mapeo de requisitos del Documento Maestro contra el código (15 jul 2026) | Análisis inicial; el resultado quedó reflejado en `tasks/plan.md` y `docs/current/` |
| `maestro-alignment-2026-07-16.md` | Auditoría puntual de alineación (16 jul 2026) | Snapshot de una revisión específica, no un documento vivo |
| `crm-meta-roadmap.md` | Descripción funcional del flujo CRM + Meta (16 jul 2026) | Contenido cubierto por `docs/current/03-CRM.md` y `docs/current/04-META-INTEGRATION.md` |
| `migration-2026-07-15.md` | Registro de la reorganización del repo para cPanel/Passenger (15 jul 2026) | Migración ya completada; es historial, no una guía activa |
| `plan-fases-vitahub.md` | Borrador de plan por fases (20 jul 2026) | Reemplazado por la versión comprometida en `tasks/plan.md` |
| `propuesta-comercial-vitahub-fases-0-2.md` | Propuesta comercial (20 jul 2026) | Los términos vigentes están resumidos en `tasks/plan.md` |
| `01-ERRORES-BASELINE.md` | Errores detectados en el baseline de estabilización | El propio documento se marca `ESTADO: HISTORICO - RESUELTO` |
