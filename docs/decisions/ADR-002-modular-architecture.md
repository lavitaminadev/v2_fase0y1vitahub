# ADR-002: Arquitectura Modular por Dominio

**Estado:** Accepted  
**Fecha:** 2026-07-15  
**Contexto:** VITAHUB necesita escalar a múltiples módulos de negocio sin acoplamiento.  
**Decisión:** Módulos organizados por dominio funcional. Cada módulo contiene API, casos de uso, entidades y permisos. Las integraciones van separadas por proveedor.  
**Alternativas:** Monolito plano (no escala), microservicios (infraestructura no disponible), carpetas por tipo técnico (mezcla dominios).  
**Consecuencias:** Cada funcionalidad es localizable. No hay dependencias directas entre módulos no relacionados. Favorece el desarrollo paralelo y las pruebas aisladas.
