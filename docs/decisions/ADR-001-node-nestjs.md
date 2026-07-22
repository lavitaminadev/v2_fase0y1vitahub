# ADR-001: Node.js + NestJS

**Estado:** Accepted  
**Fecha:** 2026-07-15  
**Contexto:** Selección de stack backend para VITAHUB.  
**Decisión:** Node.js 20.19+ + NestJS 11 + Express 5 + TypeScript.  
**Alternativas:** PHP/Laravel (equipo no tiene experiencia), Express puro (menos estructura), Python/Django (entorno no disponible en iHosting).  
**Consecuencias:** Backend tipado, modular, con DI, guards y decorators nativos. NestJS 11 exige Node.js 20 o superior y usa Express 5; se mantiene compatibilidad con Node.js 20.20.2 y Phusion Passenger en iHosting.
