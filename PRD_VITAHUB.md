# VitaHub — Product Requirements Document (PRD)

**Versión:** 1.0 — Arquitectura funcional definitiva de Fase 1
**Fecha:** 2026-07-28
**Estado:** Documento normativo. Reemplaza como fuente de verdad funcional a `FASE_1_CHECKLIST.md`, `UX_REDESIGN_STRATEGY.md` e `IMPLEMENTATION_MASTER_PLAN.md`, que quedan como registro histórico de ejecución.
**Alcance:** Reorganización de producto. **No se agregan funcionalidades al alcance de Fase 1**; se reordena, se renombra y se define lo que ya existe, más los conectores mínimos que faltaban para que el sistema sea coherente.
**Audiencia:** Product, UX, Frontend, Backend, QA, Comercial.

---

## Índice

1. [Visión de producto](#1-visión-de-producto)
2. [Los dos dominios y por qué no se mezclan](#2-los-dos-dominios-y-por-qué-no-se-mezclan)
3. [Actores, roles y permisos](#3-actores-roles-y-permisos)
4. [Nomenclatura definitiva](#4-nomenclatura-definitiva)
5. [Arquitectura funcional](#5-arquitectura-funcional)
6. [Navegación: el selector de espacio](#6-navegación-y-estructura-de-menú)
7. [Espacio ◆ COMERCIAL](#7-espacio--comercial--crm-de-venta-de-vitahub)
8. [Espacio ◆ OPERACIÓN](#8-espacio--operación--crm-de-reservas-y-campañas)
9. [Señales — Meta y Google](#9-señales--meta-y-google-dentro-del-espacio--operación)
10. [Análisis](#10-análisis--dos-conjuntos-de-reportes-uno-por-espacio)
11. [Espacio ◆ PLATAFORMA](#11-espacio--plataforma--administración)
12. [Handoff: de Oportunidad Ganada a Cuenta Activa](#12-handoff-de-oportunidad-ganada-a-cuenta-activa)
13. [Máquinas de estado](#13-máquinas-de-estado)
14. [Flujos end-to-end](#14-flujos-end-to-end)
15. [Diseño de experiencia por pantalla](#15-diseño-de-experiencia-por-pantalla)
16. [Sistema de diseño y componentes](#16-sistema-de-diseño-y-componentes)
17. [Modelo de datos lógico](#17-modelo-de-datos-lógico)
18. [Mapa de APIs](#18-mapa-de-apis)
19. [Matriz de permisos](#19-matriz-de-permisos)
20. [Métricas de producto](#20-métricas-de-producto)
21. [No-objetivos de Fase 1 y roadmap](#21-no-objetivos-de-fase-1-y-roadmap)
22. [Anexos](#22-anexos)

---

## 1. Visión de producto

### 1.1 Qué es VitaHub

VitaHub es una plataforma SaaS multiempresa que conecta la inversión publicitaria de un restaurante con su operación real de mesas, y devuelve a las plataformas de anuncios la señal de lo que efectivamente ocurrió.

El valor no está en "tener un formulario de reservas". Está en cerrar el circuito:

> El anuncio genera una reserva → la reserva genera un evento de conversión → la asistencia real genera un segundo evento → el algoritmo de Meta/Google aprende a buscar comensales que **asisten**, no clics que reservan y no llegan.

Ese segundo evento —la asistencia confirmada— es la propuesta de valor diferencial. Ninguna herramienta de reservas genérica lo envía, porque ninguna sabe quién se sentó a la mesa.

### 1.2 Quién es quién

- **La Vitamina** — agencia dueña de VitaHub. Vende la plataforma, opera las campañas de sus clientes y da soporte.
- **Cliente / Cuenta** — restaurante que contrata VitaHub. Configura su agenda, recibe reservas, marca asistencia.
- **Comensal** — persona que reserva desde una campaña. Nunca entra a VitaHub: solo ve la página pública de reserva.

### 1.3 Principios de producto

| # | Principio | Consecuencia de diseño |
|---|---|---|
| P1 | **Un dato, un dueño** | Cada entidad pertenece a un dominio. No hay entidades "de los dos". |
| P2 | **La asistencia es el evento rey** | Toda la UI de operación empuja hacia marcar asistencia el mismo día. |
| P3 | **La señal debe ser auditable** | Todo evento enviado a Meta/Google tiene traza visible: qué se envió, cuándo, con qué resultado. |
| P4 | **Nada se pierde en silencio** | Si un envío falla, hay reintento persistente y un lugar donde verlo. |
| P5 | **Un proceso Node + MySQL + cron** | Restricción de plataforma (iHosting/cPanel). Ninguna propuesta de este PRD requiere Redis, brokers, workers persistentes ni sidecars. |
| P6 | **El dato personal se envía solo con permiso explícito** | Las capabilities `metaConversions` y `googleConversions` vienen desactivadas por defecto. |

---

## 2. Los dos dominios y por qué no se mezclan

VitaHub contiene dos CRM. Confundirlos es el error estructural que este documento corrige.

```
┌──────────────────────────────────────────────────────────────────┐
│  DOMINIO A — COMERCIAL (de La Vitamina)                          │
│  Pregunta que responde: ¿a quién le vendemos VitaHub?            │
│  Sujeto: una EMPRESA que todavía no es cliente.                  │
│  Ciclo: semanas o meses. Cierre = contrato firmado.              │
│  Lo opera: el equipo comercial de La Vitamina.                   │
│  Un cliente NUNCA ve este dominio.                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                  se gana la oportunidad
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOMINIO B — OPERACIÓN (dentro de VitaHub)                       │
│  Pregunta que responde: ¿quién reservó mesa en este restaurante? │
│  Sujeto: una PERSONA que quiere comer.                           │
│  Ciclo: días. Cierre = asistió o no asistió.                     │
│  Lo opera: el restaurante (y La Vitamina en su nombre).          │
│  Cada cuenta ve solo lo suyo.                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Tabla de separación

| Eje | Comercial | Operación |
|---|---|---|
| Nombre en producto | **Espacio ◆ Comercial** | **Espacio ◆ Operación** |
| Ruta base | `/sales` | `/ops` |
| Acento visual | Rosa | Cian |
| Entidad principal | Empresa / Oportunidad | Reserva / Contacto de Campaña |
| Sujeto | Organización jurídica | Persona natural |
| Origen | Prospección, referidos, inbound | Campaña Meta/Google, página pública |
| Estados | Lead → … → Ganada | Pendiente → … → Asistió |
| Éxito | Contrato firmado | Comensal sentado en la mesa |
| Métrica | Valor de pipeline, tasa de cierre | Reservas, tasa de asistencia, ROAS |
| Multi-tenant | Ámbito único: La Vitamina | Segmentado por `clientId` |
| Visible para el cliente | ❌ Nunca | ✅ Solo su cuenta |

### 2.2 Deuda concreta detectada en el código

El enum `LeadStatus` (`apps/api/src/modules/crm/leads/lead-status.enum.ts`) mezcla hoy los dos ciclos en una sola lista:

```ts
new, contacted, meeting_scheduled, quote_sent, negotiation,  // ciclo comercial
reserved, attended, no_show,                                  // ciclo de reservas
won, lost
```

Un mismo campo describe "el prospecto pidió cotización" y "la señora Pérez no llegó a comer". Eso hace imposible un embudo comercial confiable y un reporte de asistencia confiable, porque cualquier conteo por estado suma peras con manzanas.

**Decisión de producto:** separar las dos máquinas de estado (ver §13). La tabla `crm_leads` puede seguir existiendo físicamente; lo que se separa es el **campo de estado** y las **vistas**. Ver §17.4 para la propuesta de migración mínima.

---

## 3. Actores, roles y permisos

### 3.1 Actores

| Actor | Dónde vive | Qué hace |
|---|---|---|
| **Comensal** | Web pública | Reserva. No autentica. |
| **Anfitrión** (staff del restaurante) | App, ámbito cuenta | Ve la bandeja del día, marca asistencia. |
| **Gerente de Cuenta** (dueño/gerente del restaurante) | App, ámbito cuenta | Configura agenda, páginas de reserva, ve reportes. |
| **Ejecutivo Comercial** (La Vitamina) | App, ámbito global | Opera Ventas: empresas, pipeline, cotizaciones. |
| **Director Comercial** (La Vitamina) | App, ámbito global | Ventas + forecast + reasignación. |
| **Operador de Cuentas** (La Vitamina) | App, ámbito global | Opera Operación en nombre de las cuentas. |
| **Administrador de Plataforma** | App, ámbito global | Usuarios, integraciones, cola de envíos, logs. |

### 3.2 Mapeo a los roles existentes

Los roles del sistema son los del tipo `UserRole` (`packages/shared/src/types/user.ts`). **No se crean roles nuevos**; se define qué persona de negocio corresponde a cada uno.

| Rol técnico existente | Persona de negocio | Ámbito |
|---|---|---|
| `admin` | Administrador de Plataforma | Global |
| `commercial_director` | Director Comercial | Global, dominio Comercial |
| `operations_director` | Operador de Cuentas (jefatura) | Global, dominio Operación |
| `creative_director`, `art_director`, `av_director`, `ai_lead`, `community_manager`, `designer`, `audiovisual` | Equipo de producción de La Vitamina | Global, sin acceso a Ventas ni a datos personales de comensales |
| `client` | Gerente de Cuenta / Anfitrión | Restringido a su `clientId` |

> **Regla dura:** ningún usuario con rol `client` puede ver rutas del dominio Comercial. Esto ya se resuelve por `PATH_FEATURE` + capability `commercialPipeline` en `navigation.registry.ts`, y debe cubrirse además con guard de backend (defensa en profundidad: ocultar el menú no es autorizar).

### 3.3 Niveles de permiso por módulo

Cada par (rol, módulo) resuelve a uno de cuatro niveles, ya soportados por el backend de permisos efectivos:

- `none` — el módulo no existe para ese usuario (no aparece en el menú, la ruta responde 403).
- `read` — ve, filtra y exporta.
- `write` — crea y edita.
- `admin` — además configura, borra y ve datos sensibles (tokens, PII completa).

Matriz completa en §19.

---

## 4. Nomenclatura definitiva

Los nombres actuales describen implementación ("Bandeja", "Outbox", "Salud Conversiones") en vez de intención de usuario. Esta tabla es normativa: **el texto de la UI usa la columna "Nombre definitivo"**; el nombre técnico se conserva en el código para no romper nada.

| Nombre actual (UI) | Nombre definitivo (UI) | Por qué | Nombre técnico (sin cambios) |
|---|---|---|---|
| CRM (sección) | **◆ Operación** (espacio) | "CRM" era ambiguo entre los dos dominios; ahora es un espacio propio | `crm` |
| CRM Básico / Contactos | **Audiencia** | Son personas que reservan, no contactos comerciales | `crm/contacts` |
| Pipeline (sección) | **◆ Comercial** (espacio) | Es un CRM completo, no una sección | `commercialPipeline` |
| Administración (sección) | **◆ Plataforma** (espacio) | Separa la administración del sistema de ambos CRM | `governance` |
| Prospectos (etiqueta actual de `/crm/leads`) | **Empresas** | El sujeto es una organización, no una persona. "Prospecto" describe su estado, no lo que es; el estado ya vive en el campo de etapa | `crm/leads` |
| Oportunidades | **Oportunidades** | Correcto, se mantiene | `crm/opportunities` |
| Interacciones | **Actividades** | Es lo que el ejecutivo registra: llamada, reunión, correo | `crm/interactions` |
| Catálogo | **Catálogo y Cotizaciones** | El módulo hace ambas cosas | `catalog` |
| Bandeja | **Reservas** | La bandeja es una vista, no un módulo | `reservations` |
| Formularios | **Páginas de Reserva** | Es una página pública publicable, no un formulario interno | `reservations/forms` |
| Disponibilidad | **Agenda** | Incluye horarios, cupos y bloqueos | `scheduleConfig` + `AvailabilityBlock` |
| Bloqueos | **Cierres** | "Cierre por vacaciones" es el lenguaje del restaurante | `AvailabilityBlock` |
| Meta | **Conexiones** | Agrupa Meta y Google bajo un concepto | `integrations` |
| Salud Conversiones | **Calidad de Señal** | Mide qué tan bien Meta reconoce a la persona | `meta/:id/health` |
| Outbox | **Cola de Envíos** | Español y comprensible para el operador | `meta_conversion_outbox`, `google_conversion_outbox` |
| Clientes | **Cuentas** | Un "cliente" en Ventas es un prospecto ganado; "Cuenta" es el restaurante operando | `clients` |
| Configuración | **Ajustes** (personal) / **Administración** (plataforma) | Se separan dos cosas que hoy se llaman igual | `settings` / `governance` |
| Campo protegido | **Campo obligatorio del sistema** | "Protegido" no dice nada al usuario | — |

### 4.1 Reglas de nomenclatura

1. **Español rioplatense/chileno neutro**, sin anglicismos evitables. Excepción: nombres propios de terceros (Meta, Pixel, Conversions API, Google Ads).
2. **Sustantivos en plural para listados** ("Reservas", "Cuentas"), **verbo en infinitivo para acciones** ("Marcar asistencia", "Enviar cotización").
3. **Un concepto, un nombre, en toda la app.** Si en Reservas se dice "Cuenta", en Reportes no se dice "Cliente".
4. **Los estados se nombran desde el punto de vista del usuario**, no del sistema: "No asistió", no "no_show".

---

## 5. Arquitectura funcional

### 5.0 Tres espacios de trabajo, un solo inicio de sesión

VitaHub **no es una aplicación con secciones**. Son dos CRM distintos —más un espacio de plataforma— que comparten autenticación y nada más. El usuario elige explícitamente en cuál está parado, y esa elección cambia el menú completo, el color de la interfaz, la URL y el alcance del buscador.

```
                        ┌──────────────────────┐
                        │   Inicio de sesión   │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │   Selector de espacio        │
                    │   (fijo, arriba del menú)    │
                    └──┬────────────┬───────────┬──┘
                       │            │           │
        ┌──────────────▼──┐  ┌──────▼───────┐  ┌▼─────────────┐
        │  ◆ COMERCIAL    │  │ ◆ OPERACIÓN  │  │ ◆ PLATAFORMA │
        │  «Vender        │  │ «Operar      │  │ «Administrar │
        │   VitaHub»      │  │  VitaHub»    │  │  el sistema» │
        │                 │  │              │  │              │
        │  Acento: ROSA   │  │ Acento: CIAN │  │ Acento: GRIS │
        │  Ruta: /sales   │  │ Ruta: /ops   │  │ Ruta: /admin │
        │                 │  │              │  │              │
        │  Sujeto:        │  │ Sujeto:      │  │ Sujeto:      │
        │  empresas       │  │ comensales   │  │ usuarios     │
        └─────────────────┘  └──────────────┘  └──────────────┘
                 │                   ▲
                 └──── handoff ──────┘
                  (único puente, §12)
```

**Regla fundacional:** ninguna pantalla, listado, buscador, reporte o exportación cruza de un espacio a otro. El único tránsito posible es el handoff de §12, y es unidireccional.

---

### 5.1 Espacio COMERCIAL — CRM de La Vitamina

Ruta base `/sales` · Acento rosa · Sin selector de cuenta · Invisible para el rol `client`.

```
◆ COMERCIAL
│
├── Inicio Comercial                    Forecast, embudo, qué requiere atención
│
├── Pipeline                            Tablero Kanban de oportunidades
├── Oportunidades                       El mismo dato en lista, para ordenar y exportar
├── Empresas                            Organizaciones prospecto
├── Contactos                           Personas dentro de esas empresas
├── Cotizaciones                        Propuestas económicas versionadas
├── Actividades                         Llamadas, reuniones, correos ya ocurridos
├── Tareas                              Pendientes con vencimiento y responsable
├── Contratos                           Firma y vigencia
├── Documentos                          Adjuntos del ciclo de venta
├── Reportes Comerciales                Embudo, cierre, ciclo, pérdidas
└── Ajustes Comerciales                 Etapas, probabilidades, motivos de pérdida, SLA
```

---

### 5.2 Espacio OPERACIÓN — VitaHub en funcionamiento

Ruta base `/ops` · Acento cian · **Con selector de cuenta** · Es el único espacio que ve el rol `client`.

```
◆ OPERACIÓN                              [ Cuenta: Todas ▾ ]
│
├── Inicio Operativo                     Reservas de hoy, sin marcar, ocupación
│
├── Reservas                             Bandeja operativa del día
├── Calendario                           Vista mes / semana / día
├── Agenda                               Horarios, cupos y cierres
├── Páginas de Reserva                   Constructor y publicación
├── Audiencia                            Comensales, historial y frecuencia
│
├── Cuentas                              Directorio de restaurantes
│   └── Ficha de Cuenta
│       ├── Información                  Datos, logo, estado, responsable
│       ├── Módulos                      Capabilities activadas
│       ├── Conexiones                   Pixel, CAPI, Google Ads de esa cuenta
│       ├── Páginas de Reserva           Las que le pertenecen
│       ├── Agenda                       Horarios, cupos, cierres
│       └── Facturación                  Plan y estado de cobro
│
├── Señales                              Integración publicitaria
│   ├── Conexiones                       Meta y Google: cuentas, tokens, estado
│   ├── Calidad de Señal                 Match Quality, cobertura de identificadores
│   ├── Cola de Envíos                   Eventos pendientes, fallidos, reintentos
│   └── Diagnóstico                      Prueba de evento, validación de Pixel
│
└── Reportes de Operación                Reservas, asistencia, ocupación, origen
```

> **Cuentas y Señales viven acá, no en un espacio propio.** Una cuenta, vista desde el producto, es una configuración operativa: agenda, páginas, pixel. Su historia comercial pertenece al otro espacio y se alcanza solo por el enlace de origen (§15.7).

---

### 5.3 Espacio PLATAFORMA — administración del sistema

Ruta base `/admin` · Acento gris neutro · Solo rol `admin` (lectura para `operations_director`).

```
◆ PLATAFORMA
│
├── Usuarios                             Alta, rol, espacio y cuenta asignada
├── Roles y Permisos                     Matriz por módulo y espacio
├── Módulos                              Feature flags por organización y cuenta
├── Registro de Auditoría                Quién hizo qué, en qué espacio, cuándo
├── Tareas Programadas                   Estado de los cron de cPanel
└── Ajustes de Plataforma                Parámetros globales
```

---

### 5.4 Ajustes personales — transversal

Fuera de los tres espacios, siempre accesible desde el avatar: **Perfil · Seguridad · Preferencias**. Es lo único que no pertenece a ningún espacio, porque pertenece a la persona.

---

### 5.5 Correspondencia con los módulos existentes

Ningún módulo del backend se elimina. Esta tabla dice dónde queda cada uno en la nueva estructura.

| Espacio | Módulo PRD | Módulos backend existentes |
|---|---|---|
| Comercial | Pipeline, Oportunidades, Empresas, Contactos, Actividades | `crm/leads`, `crm/opportunities`, `crm/interactions`, `crm/contacts` (domain=commercial) |
| Comercial | Cotizaciones, Contratos, Documentos | `catalog` (quotes), `contracts`, `documents`, `billing` |
| Comercial | Reportes Comerciales | `reports`, `dashboards` |
| Operación | Reservas, Calendario, Agenda, Páginas | `reservations` |
| Operación | Audiencia | `crm/contacts` (domain=audience) |
| Operación | Cuentas | `clients`, `organizations`, `onboarding`, `briefs`, `meetings` |
| Operación | Señales | `integrations` (meta, google), `core/cron` |
| Operación | Reportes de Operación | `reports`, `dashboards` |
| Plataforma | Todo | `users`, `core/audit`, `governance`, `operations`, `knowledge`, `core/parameters` |
| — | Sin ubicación en Fase 1 (ocultos por capability) | `production`, `content`, `audiovisual`, `approvals`, `gamification`, `pods`, `objectives`, `design-budget`, `account-cycles`, `workflows` |

> Los módulos de la última fila pertenecen al negocio de agencia de La Vitamina, no al producto VitaHub. Se mantienen activables por capability pero **fuera del menú por defecto**, para que el producto que se vende no arrastre la operación interna de la agencia.

---

## 6. Navegación y estructura de menú

### 6.1 El selector de espacio

Es el elemento más importante de la interfaz. Ocupa el tope del menú lateral, siempre visible, y responde a una sola pregunta: **¿en cuál de los dos CRM estoy?**

```
┌──────────────────────────────┐
│ ◆ COMERCIAL              ▾   │  ← barra de espacio (48px), acento rosa
│   CRM de venta de VitaHub    │
└──────────────────────────────┘
```

Al abrirlo:

```
┌────────────────────────────────────────────┐
│  CAMBIAR DE ESPACIO                        │
├────────────────────────────────────────────┤
│  ● ◆ COMERCIAL                      ✓      │
│      Vender VitaHub                        │
│      Empresas · Pipeline · Cotizaciones    │
│      12 oportunidades abiertas             │
├────────────────────────────────────────────┤
│  ○ ◆ OPERACIÓN                             │
│      Operar VitaHub                        │
│      Reservas · Agenda · Audiencia         │
│      8 cuentas · 47 reservas hoy           │
├────────────────────────────────────────────┤
│  ○ ◆ PLATAFORMA                            │
│      Administrar el sistema                │
│      Usuarios · Módulos · Auditoría        │
└────────────────────────────────────────────┘
```

**Comportamiento.**

| Aspecto | Definición |
|---|---|
| Cambio de espacio | Navega a la raíz del espacio destino (`/sales`, `/ops`, `/admin`). **No intenta preservar la pantalla equivalente**: no hay equivalencias entre espacios, y fingir que las hay reintroduce la confusión que este diseño elimina. |
| Persistencia | El último espacio usado se guarda por usuario y se restaura al iniciar sesión. Un ejecutivo comercial entra siempre a Comercial sin tocar nada. |
| Un solo espacio disponible | El selector **no se muestra**. Un gerente de restaurante nunca sabe que existen otros espacios. |
| Atajo | `Ctrl/Cmd + Shift + E` abre el selector. `Ctrl/Cmd + 1/2/3` salta directo. |
| Contador en cada opción | Da una razón para cambiar sin cambiar: "3 envíos fallidos" en Operación se ve desde Comercial sin salir. |
| Estado sin acceso | Un espacio al que el usuario no tiene acceso **no aparece**. No se muestra bloqueado. |

### 6.2 Diferenciación visual — no alcanza con el menú

Dos CRM que se ven iguales se confunden igual. Cada espacio tiene identidad propia y permanente:

| Elemento | ◆ Comercial | ◆ Operación | ◆ Plataforma |
|---|---|---|---|
| Color de acento | Rosa `--rosa` #EA0F63 | Cian `--cian` #0EC6B8 | Gris `--txt-secondary` |
| Barra superior del sidebar | Franja rosa de 3px | Franja cian de 3px | Franja gris de 3px |
| Item activo del menú | Fondo rosa 8% + borde izquierdo rosa | Fondo cian 8% + borde izquierdo cian | Fondo gris 8% |
| Botones primarios | Rosa | Cian | Gris oscuro |
| Icono del espacio | Maletín | Tenedor y cuchillo | Engranaje |
| Favicon y título de pestaña | `Comercial · VitaHub` | `Operación · VitaHub` | `Admin · VitaHub` |
| Prefijo de migas | `Comercial /` | `Operación /` | `Plataforma /` |

> El color no es decorativo: es el mecanismo por el que alguien que trabaja en los dos espacios sabe dónde está antes de leer. En Operación el rosa se reserva para lo destructivo y "no asistió"; en Comercial el cian se reserva para lo informativo. La inversión de acento es deliberada y consistente.

### 6.3 Menú de cada espacio

#### ◆ COMERCIAL

```
┌────────────────────────────┐
│ ◆ COMERCIAL            ▾   │
├────────────────────────────┤
│ ⌂  Inicio                  │
│                            │
│ ▦  Pipeline                │
│ ≡  Oportunidades           │
│ ⌂  Empresas                │
│ ☺  Contactos               │
│ ⎘  Cotizaciones            │
│ ✓  Tareas            ③     │
│ ⏱  Actividades             │
│ ⎙  Contratos               │
│ 🗀  Documentos              │
│                            │
│ ▤  Reportes                │
│ ⚙  Ajustes Comerciales     │
├────────────────────────────┤
│ [Avatar] Nombre         ▾  │
└────────────────────────────┘
```
Sin secciones: doce entradas planas. La taxonomía interna sobra cuando el espacio ya delimitó el dominio.

#### ◆ OPERACIÓN — equipo Vitamina

```
┌────────────────────────────┐
│ ◆ OPERACIÓN            ▾   │
├────────────────────────────┤
│ Cuenta: [ Todas        ▾ ] │  ← selector de cuenta, exclusivo de este espacio
├────────────────────────────┤
│ ⌂  Inicio                  │
│                            │
│ ▣  Reservas          ⑥     │
│ ▦  Calendario              │
│ ⏱  Agenda                  │
│ ⎘  Páginas de Reserva      │
│ ☺  Audiencia               │
│                            │
│ ⌂  Cuentas                 │
│                            │
│ ⚡ Señales                 │
│    ├ Conexiones            │
│    ├ Calidad de Señal      │
│    └ Cola de Envíos   ③    │
│                            │
│ ▤  Reportes                │
├────────────────────────────┤
│ [Avatar] Nombre         ▾  │
└────────────────────────────┘
```

#### ◆ OPERACIÓN — rol `client` (gerente del restaurante)

```
┌────────────────────────────┐
│ [Logo del restaurante]     │  ← sin selector de espacio ni de cuenta
├────────────────────────────┤
│ ⌂  Inicio                  │
│ ▣  Reservas          ⑥     │
│ ▦  Calendario              │
│ ⏱  Agenda                  │
│ ⎘  Páginas de Reserva      │
│ ☺  Audiencia               │
│ ▤  Reportes                │
├────────────────────────────┤
│ [Avatar] Nombre         ▾  │
└────────────────────────────┘
```
Siete entradas planas, sin selector, sin Señales, sin Cuentas. Para este usuario **VitaHub es un solo CRM** y nunca sabrá que existe otro. Es el resultado más importante de esta separación.

#### ◆ PLATAFORMA

```
┌────────────────────────────┐
│ ◆ PLATAFORMA           ▾   │
├────────────────────────────┤
│ ☺  Usuarios                │
│ ⚿  Roles y Permisos        │
│ ⊞  Módulos                 │
│ ⏱  Auditoría               │
│ ⚙  Tareas Programadas   ⚠  │
│ ⚙  Ajustes de Plataforma   │
├────────────────────────────┤
│ [Avatar] Nombre         ▾  │
└────────────────────────────┘
```

### 6.4 Reglas de navegación

| Regla | Detalle |
|---|---|
| **El buscador es por espacio** | `Ctrl/Cmd + K` busca **solo dentro del espacio actual**. En Comercial: empresas, contactos comerciales, oportunidades, cotizaciones. En Operación: reservas, comensales, cuentas, páginas. Si no hay resultados, y solo entonces, ofrece: "Sin resultados en Operación. ¿Buscar en Comercial?" — con el cambio de espacio explícito, nunca automático. |
| **Selector de cuenta: exclusivo de Operación** | Filtra Reservas, Calendario, Agenda, Páginas, Audiencia, Señales y Reportes. Comercial no lo tiene, porque una cuenta no existe todavía en el mundo comercial. |
| **Sin navegación cruzada** | Ningún enlace lleva de un espacio a otro, salvo dos excepciones explícitas y etiquetadas: el handoff (§12) y el enlace "Origen comercial" de la ficha de cuenta (§15.7). Ambos avisan que van a cambiar de espacio antes de hacerlo. |
| **URL sin ambigüedad** | Toda ruta lleva el prefijo de su espacio. Pegar una URL de `/sales/...` estando en Operación cambia el espacio automáticamente (la URL es una intención explícita del usuario) y lo indica con un aviso breve. |
| **Acceso denegado** | Entrar por URL a un espacio sin permiso devuelve 403 del backend, no una redirección silenciosa. Ocultar el menú no es autorizar. |
| **Colapsable** | 280px → 64px. Colapsado deja visible el icono del espacio con su color: la identidad no se pierde. Submenú flotante al hover. Estado en `localStorage`, por espacio. |
| **Móvil (<768px)** | Drawer con overlay. El selector de espacio queda en la cabecera del drawer, con su color de fondo. Barra inferior con 3 accesos del espacio actual (Operación `client`: Reservas · Calendario · Agenda). |
| **Indicadores** | Un badge por espacio como máximo, en la entrada más accionable: Comercial → Tareas vencidas. Operación → Reservas sin marcar y Cola de Envíos fallidos. Plataforma → cron caído. |
| **Módulo deshabilitado** | No se muestra. |
| **Migas de pan** | Siempre con el espacio como raíz: `Operación / Reservas / #RES-1042`. |

### 6.5 Rutas

Todas las rutas viven bajo el prefijo de su espacio. El prefijo es la garantía técnica de la separación: un guard por prefijo cubre el espacio completo.

#### `/sales/**` — CRM Comercial

| Ruta | Vista |
|---|---|
| `/sales` | Inicio Comercial |
| `/sales/pipeline` | Pipeline (Kanban) |
| `/sales/opportunities` | Oportunidades (lista) |
| `/sales/opportunities/:id` | Ficha de Oportunidad |
| `/sales/companies` | Empresas |
| `/sales/companies/:id` | Ficha de Empresa |
| `/sales/contacts` | Contactos Comerciales |
| `/sales/contacts/:id` | Ficha de Contacto |
| `/sales/quotes` | Cotizaciones |
| `/sales/quotes/:id` | Detalle / constructor de cotización |
| `/sales/tasks` | Tareas |
| `/sales/activities` | Actividades |
| `/sales/contracts` | Contratos |
| `/sales/documents` | Documentos comerciales |
| `/sales/reports` | Reportes Comerciales |
| `/sales/settings` | Ajustes Comerciales (etapas, SLA, motivos) |

#### `/ops/**` — CRM de Operación

| Ruta | Vista |
|---|---|
| `/ops` | Inicio Operativo |
| `/ops/reservations` | Bandeja de Reservas |
| `/ops/reservations/:id` | Detalle de reserva (panel lateral con URL propia) |
| `/ops/calendar` | Calendario |
| `/ops/schedule` | Agenda |
| `/ops/pages` | Páginas de Reserva |
| `/ops/pages/:id/edit` | Constructor |
| `/ops/audience` | Audiencia |
| `/ops/audience/:id` | Ficha de comensal |
| `/ops/accounts` | Directorio de Cuentas |
| `/ops/accounts/:id` | Ficha de Cuenta |
| `/ops/signals` | Conexiones |
| `/ops/signals/quality` | Calidad de Señal |
| `/ops/signals/queue` | Cola de Envíos |
| `/ops/reports` | Reportes de Operación |

#### `/admin/**` — Plataforma

| Ruta | Vista |
|---|---|
| `/admin/users` · `/admin/roles` · `/admin/modules` · `/admin/audit` · `/admin/jobs` · `/admin/settings` | Administración |

#### Transversales

| Ruta | Vista |
|---|---|
| `/settings` | Ajustes personales (fuera de todo espacio) |
| `/login` | Inicio de sesión |
| `/r/:slug` | **Página pública de reserva** (sin sesión, sin espacio) |

> Las rutas actuales (`/crm/leads`, `/crm/opportunities`, `/reservations`, `/clients`, …) se mantienen con redirección permanente a su equivalente con prefijo, para no romper enlaces guardados ni marcadores.

### 6.6 Implicaciones técnicas de la separación

| # | Implicación |
|---|---|
| N1 | `NAVIGATION_SECTIONS` en `navigation.registry.ts` deja de ser una lista plana de secciones y pasa a ser un registro **por espacio**: `WORKSPACES: { id, label, accent, basePath, sections[] }`. `getNavigationSections()` recibe el espacio activo como argumento. |
| N2 | Cada `FeatureManifest` declara a qué espacio pertenece (`workspace: 'sales' \| 'ops' \| 'admin'`). Una feature sin espacio declarado no se registra: evita que un módulo nuevo aparezca en el CRM equivocado por omisión. |
| N3 | Un guard de backend por prefijo de ruta (`/sales`, `/ops`, `/admin`) valida el acceso al espacio antes de cualquier guard de módulo. Es la defensa que hace real la separación; el menú es solo su reflejo. |
| N4 | El espacio activo se guarda en preferencias de usuario, no en `localStorage`: debe sobrevivir al cambio de dispositivo. |
| N5 | El `AppShell` recibe el espacio como contexto y de ahí derivan acento, icono, título de pestaña y alcance del buscador. Un solo lugar decide la identidad visual. |

---

## 7. Espacio ◆ COMERCIAL — CRM de venta de VitaHub

**Ruta base `/sales` · acento rosa · sin selector de cuenta · invisible para el rol `client`.**

Cada módulo se especifica con la misma ficha: **Objetivo · Usuarios · Permisos · Información visible · Acciones · Flujos · Estados · Componentes · APIs · Relaciones**.

---

### 7.1 Panel Comercial

**Objetivo.** Responder en diez segundos: ¿vamos a cumplir el mes, y qué está frenado?

**Usuarios.** Director Comercial (vista equipo), Ejecutivo Comercial (vista propia), Administrador.

**Permisos.** `commercialPipeline: read`. El Ejecutivo ve solo sus oportunidades; el Director ve todas y puede alternar entre "Mi cartera" y "Equipo".

**Información visible.**
- Cuatro tarjetas de cabecera: Valor de pipeline abierto · Valor ponderado (Σ monto × probabilidad) · Cerrado en el mes · Tasa de cierre últimos 90 días.
- Embudo horizontal por etapa: cantidad y monto por etapa, con ancho proporcional.
- "Requiere atención": oportunidades sin actividad hace más de N días (N configurable por etapa), ordenadas por monto descendente.
- "Cierres esperados este mes": lista con fecha estimada de cierre y probabilidad.
- Actividad del equipo: actividades registradas por persona en los últimos 7 días.

**Acciones.** Filtrar por período, ejecutivo y origen. Abrir oportunidad. Registrar actividad rápida desde la lista de atención.

**Flujos.** Entrada única al dominio Comercial al iniciar sesión un rol comercial.

**Estados de la vista.** Cargando (esqueletos) · Con datos · Vacío ("Aún no hay oportunidades. Crear la primera") · Error con reintento.

**Componentes.** `StatCard`, `FunnelChart`, `AttentionList`, `PeriodSelector`, `OwnerFilter`.

**APIs.** `GET /crm/opportunities` con agregaciones; `GET /reports/commercial/summary` (nuevo endpoint de agregación, sin nuevas tablas).

**Relaciones.** Lee de Oportunidades y Actividades. No toca Operación.

---

### 7.2 Pipeline

**Objetivo.** Mover oportunidades entre etapas con el mínimo de fricción y ver el embudo real.

**Usuarios.** Ejecutivo Comercial, Director Comercial.

**Permisos.** `commercialPipeline: write` para arrastrar; `read` para ver.

**Información visible.** Tablero Kanban con una columna por etapa (§7.10). Cada columna muestra en su cabecera: nombre de etapa, cantidad, monto total. Cada tarjeta muestra:
- Nombre de la oportunidad y empresa
- Monto y probabilidad
- Responsable (avatar)
- Próxima acción y su fecha
- Indicador de antigüedad en etapa: punto verde (<7d), ámbar (7–14d), rojo (>14d)

**Acciones.** Arrastrar entre columnas · Crear oportunidad (botón fijo) · Filtro por responsable, origen, rango de monto · Alternar a vista Lista · Búsqueda.

**Flujos.**
1. Arrastrar a la siguiente etapa → si la etapa destino exige un requisito (ej.: "Propuesta" exige cotización adjunta), se abre un diálogo pidiéndolo; se puede omitir con justificación, que queda en el historial.
2. Arrastrar a "Ganada" → dispara el handoff a Cuentas (§12). Es la única transición con confirmación de dos pasos.
3. Arrastrar a "Perdida" → obliga a elegir motivo de pérdida de una lista cerrada (precio, tiempo, competencia, sin presupuesto, sin respuesta, otro).

**Estados.** Ver máquina de estados en §13.2.

**Componentes.** `KanbanBoard` (dnd-kit, la misma base ya adoptada para el constructor de formularios), `OpportunityCard`, `StageHeader`, `LossReasonDialog`, `WinConfirmationFlow`.

**APIs.** `GET /crm/opportunities` · `POST /crm/opportunities` · `PATCH /crm/opportunities/:id` (cambio de `stage` y `probability`) · `DELETE /crm/opportunities/:id`.

**Relaciones.** Empresa (origen), Cotizaciones (requisito de etapa), Actividades (registro), Cuentas (destino al ganar).

---

### 7.3 Oportunidades (vista lista)

**Objetivo.** El mismo dato que Pipeline, para quien necesita ordenar, comparar y exportar en vez de arrastrar.

**Usuarios y permisos.** Idénticos a Pipeline.

**Información visible.** Tabla densa: Oportunidad · Empresa · Etapa (badge) · Monto · Probabilidad · Ponderado · Cierre estimado · Responsable · Última actividad · Días en etapa.

**Acciones.** Ordenar por cualquier columna · Selección múltiple → reasignar responsable, cambiar etapa en lote, exportar · Guardar vistas filtradas ("Mis cierres de este mes").

**Componentes.** `DataTable` con columnas configurables, `BulkActionBar`, `SavedViews`, `ExportModal` (el mismo componente de Reservas).

**APIs.** Las mismas de §7.2, más `POST /crm/opportunities/export`.

---

### 7.4 Empresas

**Objetivo.** Ser el expediente único de cada organización con la que La Vitamina habla, antes y durante la relación comercial.

**Usuarios.** Ejecutivo y Director Comercial. Lectura para Administrador.

**Permisos.** `commercialPipeline: read|write`.

**Información visible (listado).** Nombre · Rubro · Ciudad · Estado comercial · Oportunidades abiertas · Valor total · Responsable · Última actividad.

**Información visible (ficha).** Cabecera con nombre, logo, estado y responsable; y pestañas:
- **Resumen** — datos fiscales y de contacto, tamaño (locales, cubiertos), origen.
- **Contactos** — personas de la empresa, con cargo y canal preferido.
- **Oportunidades** — todas las de esa empresa, abiertas y cerradas.
- **Actividades** — línea de tiempo cronológica inversa.
- **Cotizaciones** — con estado y versión.
- **Documentos** — adjuntos.
- **Notas** — texto libre fechado y firmado.
- **Historial** — cambios de estado y de responsable, generados por el sistema.

**Acciones.** Crear · Editar · Asignar responsable · Crear oportunidad desde la ficha · Registrar actividad · Adjuntar documento · Marcar como perdida/descartada · **Convertir en Cuenta** (solo visible si tiene una oportunidad ganada, §12).

**Estados.** `prospecto` → `en_conversacion` → `calificada` → `cliente` | `descartada`. El paso a `cliente` **no es manual**: lo produce el handoff.

**Componentes.** `EntityHeader`, `TabbedDetail`, `ActivityTimeline`, `RelatedList`, `NotesPanel`, `DocumentDropzone`.

**APIs.** `POST|GET|PATCH /crm/leads` (la entidad `crm_leads` cumple hoy el rol de Empresa en el dominio comercial) · `GET /crm/leads/:id` · `POST /crm/leads/:id/convert`.

**Relaciones.** Contactos Comerciales (1:N) · Oportunidades (1:N) · Cuenta (1:1 tras el handoff).

---

### 7.5 Contactos Comerciales

**Objetivo.** Registrar a las personas dentro de las empresas prospecto. **No confundir con Audiencia**, que son comensales.

**Usuarios.** Ejecutivo y Director Comercial.

**Permisos.** `commercialPipeline: read|write`.

**Información visible.** Nombre · Cargo · Empresa · Email · Teléfono · Canal preferido · Es decisor (sí/no) · Última interacción.

**Acciones.** Crear · Editar · Vincular a empresa · Marcar como decisor · Registrar actividad · Desactivar (nunca borrado físico: rompe el historial).

**Estados.** `activo` · `inactivo` · `no_contactar` (baja de comunicaciones, se respeta en cualquier envío).

**Componentes.** `DataTable`, `ContactForm`, `ContactCard`, `ConsentBadge`.

**APIs.** `POST|GET|PUT|DELETE /crm/contacts` — **con un discriminador de dominio obligatorio** (§17.4). Sin ese discriminador, este módulo y Audiencia comparten tabla y se contaminan.

**Relaciones.** Empresa (N:1) · Actividades (1:N) · Cotizaciones (destinatario).

---

### 7.6 Cotizaciones

**Objetivo.** Formalizar la propuesta económica, versionarla y saber en qué quedó.

**Usuarios.** Ejecutivo Comercial (crea), Director Comercial (aprueba sobre cierto monto).

**Permisos.** `catalog: read|write`; aprobación requiere `catalog: admin`.

**Información visible.** Número · Empresa · Oportunidad · Versión · Monto neto/total · Vigencia · Estado · Creada por · Fecha de envío · Fecha de respuesta.

**Detalle:** líneas tomadas del Catálogo de servicios y packs, con cantidad, precio unitario, descuento y subtotal; condiciones comerciales; vigencia.

**Acciones.** Crear desde catálogo · Duplicar como nueva versión · Enviar (genera PDF) · Marcar aceptada/rechazada · Registrar motivo de rechazo · Adjuntar a oportunidad.

**Estados.** `borrador` → `enviada` → `aceptada` | `rechazada` | `vencida` (automático al pasar la vigencia). Coincide con `QuoteStatus` existente.

**Reglas.**
- Una cotización enviada es inmutable: editar crea la versión siguiente.
- Aceptar una cotización mueve automáticamente la oportunidad a `Negociación` si estaba antes.
- Descuento sobre el umbral configurado exige aprobación del Director.

**Componentes.** `QuoteBuilder` (líneas + totales), `CatalogPicker`, `QuotePreview`, `VersionSelector`, `ApprovalBanner`.

**APIs.** `GET|POST /catalog/quotes` · `PATCH /catalog/quotes/:id` · `POST /catalog/quotes/:id/send` · `GET /catalog/services`, `/catalog/packs`.

**Relaciones.** Oportunidad (N:1) · Empresa · Contrato (una cotización aceptada alimenta el contrato).

---

### 7.7 Actividades y Tareas

**Objetivo.** Que ninguna conversación comercial se enfríe por olvido.

Se distinguen dos cosas que hoy viven juntas:
- **Actividad** — algo que **ya ocurrió** (llamada, reunión, correo, demo). Es histórico, inmutable.
- **Tarea** — algo que **debe ocurrir** (llamar el martes). Tiene vencimiento y responsable, y se completa.

**Usuarios.** Todo el equipo comercial.

**Permisos.** `commercialPipeline: write`. Cada uno edita lo propio; el Director puede reasignar.

**Información visible.** Vista "Mi día": vencidas (rojo), hoy, esta semana, sin fecha. Cada ítem: tipo, asunto, empresa/oportunidad vinculada, responsable, vencimiento.

**Acciones.** Registrar actividad (con fecha retroactiva) · Crear tarea · Completar · Posponer (+1d, +1sem, fecha) · Reasignar · Filtrar por tipo, responsable y vínculo.

**Estados de tarea.** `pendiente` → `completada` | `cancelada`. Una tarea vencida sigue `pendiente`, marcada como vencida por comparación de fecha (no es un estado propio: evita un job que reescriba filas).

**Automatizaciones (§7.10.3).** Al mover una oportunidad de etapa, se propone —no se impone— la tarea siguiente típica de esa etapa.

**Componentes.** `TaskList`, `ActivityTimeline`, `QuickLogBar` (una línea: tipo + texto + Enter), `DueDatePicker`, `SnoozeMenu`.

**APIs.** `POST|GET|PUT|DELETE /crm/interactions`. La entidad `crm_interactions` cubre Actividad; Tarea requiere tres campos adicionales (`due_at`, `assigned_to`, `completed_at`) sobre la misma tabla — ver §17.4.

**Relaciones.** Empresa · Contacto · Oportunidad. Toda actividad debe colgar de al menos uno.

---

### 7.8 Contratos

**Objetivo.** Registrar el compromiso firmado y su vigencia.

**Usuarios.** Director Comercial, Administrador.

**Permisos.** `contracts: read|write`.

**Información visible.** Número · Empresa/Cuenta · Servicios contratados · Monto mensual · Fecha de inicio y término · Estado · Documento firmado.

**Acciones.** Crear desde cotización aceptada · Adjuntar documento firmado · Activar · Renovar · Terminar.

**Estados.** `borrador` → `activo` → `renovado` | `terminado`.

**Reglas.** Activar un contrato es el disparador formal del handoff (§12): el paso de "vendimos" a "opera".

**APIs.** `GET|POST|PATCH /contracts`.

---

### 7.9 Documentos y Notas Comerciales

**Objetivo.** Que todo lo que se intercambió con la empresa esté en un solo lugar.

**Información visible.** Documentos: nombre, tipo, tamaño, quién subió, cuándo, a qué entidad cuelga. Notas: autor, fecha, texto, con menciones `@usuario`.

**Acciones.** Subir (arrastrar) · Previsualizar · Descargar · Eliminar (solo el autor o Administrador) · Fijar nota importante.

**Almacenamiento.** Cloudinary, con la estructura por organización ya definida: `vitahub/sales/{companyId}/`. Nunca en la carpeta de una cuenta operativa: son dominios distintos también en el almacenamiento.

**APIs.** `GET|POST|DELETE /documents` con `entityType` y `entityId`.

---

### 7.10 Pipeline comercial — definición normativa

#### 7.10.1 Etapas

| # | Etapa | Definición de entrada | Probabilidad base | Criterio de salida | SLA sin actividad |
|---|---|---|---|---|---|
| 1 | **Prospecto** | Existe la empresa y un motivo para hablarle | 5% | Se logró contacto con una persona real | 5 días |
| 2 | **Contactado** | Hubo conversación bidireccional | 10% | Se agendó una instancia de calificación | 5 días |
| 3 | **Calificación** | Se está evaluando encaje (volumen, inversión en ads, sistema de reservas actual) | 20% | Encaje confirmado + decisor identificado | 7 días |
| 4 | **Reunión** | Reunión de descubrimiento agendada o realizada | 30% | Necesidad y presupuesto explícitos | 7 días |
| 5 | **Demo** | Demostración de VitaHub realizada | 45% | Interés confirmado tras ver el producto | 7 días |
| 6 | **Propuesta** | Cotización enviada | 60% | Cotización recibida y en evaluación | 10 días |
| 7 | **Negociación** | Se discuten precio, alcance o condiciones | 75% | Acuerdo verbal | 7 días |
| 8 | **Ganada** | Contrato firmado | 100% | — (dispara handoff) | — |
| 9 | **Implementación** | Onboarding técnico en curso | 100% | Primera reserva real recibida | 14 días |
| 10 | **Cuenta Activa** | La cuenta opera sola | — | — (sale del pipeline) | — |
| ✕ | **Perdida** | Cerrada sin venta | 0% | — | — |

> **Etapas 9 y 10 son parte del pipeline visualmente, pero ya pertenecen al dominio Operación.** Se muestran en el tablero para que el comercial vea el resultado de su venta, en columnas visualmente diferenciadas (fondo tenue, borde punteado) y **sin permitir arrastre hacia atrás**. Es la costura entre dominios y debe verse como tal.

#### 7.10.2 Reglas de probabilidad y valor

- La probabilidad se **precarga** desde la etapa y es **editable** por el ejecutivo: el juicio humano sobre un trato concreto vale más que la media de la etapa.
- El valor ponderado del pipeline es `Σ (monto × probabilidad)`. Es la cifra de forecast; el monto bruto solo se usa para dimensionar.
- El monto se toma de la cotización aceptada cuando existe; antes es una estimación del ejecutivo, marcada visualmente como tal (icono de estimación).
- Una oportunidad sin monto no entra al forecast, pero sí al conteo del embudo.

#### 7.10.3 Automatizaciones

Todas ejecutables dentro del proceso Node + cron de cPanel. Ninguna requiere infraestructura adicional.

| Disparador | Acción | Tipo |
|---|---|---|
| Oportunidad creada | Asignar responsable = quien la creó; probabilidad = base de etapa | Inmediata |
| Cambio de etapa | Registrar actividad de sistema "Etapa: X → Y"; actualizar probabilidad base; **proponer** la tarea típica de la nueva etapa | Inmediata |
| Cotización marcada `enviada` | Mover oportunidad a `Propuesta` si estaba antes | Inmediata |
| Cotización `aceptada` | Mover a `Negociación`; notificar al Director si supera el umbral | Inmediata |
| Vigencia de cotización superada | Estado → `vencida`; crear tarea "Renovar o cerrar" | Cron diario |
| SLA de etapa superado sin actividad | Marcar la oportunidad como "requiere atención"; notificar al responsable | Cron diario |
| Oportunidad → `Ganada` | Ejecutar handoff (§12) | Inmediata, transaccional |
| Oportunidad → `Perdida` | Exigir motivo; cerrar tareas pendientes vinculadas | Inmediata |
| Cuenta sin reservas 14 días tras `Implementación` | Alerta al Operador de Cuentas | Cron diario |

**Los recordatorios se envían por el módulo de notificaciones existente** (`core/notifications`), en el barrido diario del cron de cPanel. No hay envíos en tiempo real: es una decisión consciente dada la plataforma, y para recordatorios comerciales la granularidad diaria es suficiente.

---

## 8. Espacio ◆ OPERACIÓN — CRM de reservas y campañas

**Ruta base `/ops` · acento cian · con selector de cuenta · es el único espacio que ve el rol `client`.**

---

### 8.1 Inicio (Cuenta)

**Objetivo.** Que el gerente del restaurante sepa, al abrir la app, cómo viene el día.

**Usuarios.** Gerente de Cuenta, Anfitrión, Operador de Cuentas.

**Permisos.** `dashboard: read`, con ámbito de cuenta.

**Información visible.**
- Tarjetas: Reservas hoy · Comensales hoy · Ocupación del cupo diario (barra) · Pendientes de marcar asistencia.
- "Próximas 3 horas": lista compacta con hora, nombre, número de personas y estado.
- Tendencia semanal: reservas y tasa de asistencia, últimos 7 días vs. 7 previos.
- Aviso de configuración cuando algo falta: sin agenda configurada, sin página publicada, o Pixel sin conectar.

**Acciones.** Marcar asistencia desde la lista de próximas horas. Ir a la bandeja completa.

**Componentes.** `StatCard`, `UpcomingList`, `TrendSparkline`, `SetupChecklist`.

**APIs.** `GET /reservations/analytics/metrics` · `GET /reservations?date=today`.

---

### 8.2 Reservas (bandeja)

**Objetivo.** Ser la pantalla operativa del día. Todo lo demás en Operación existe para alimentarla.

**Usuarios.** Anfitrión (uso intensivo), Gerente de Cuenta, Operador de Cuentas.

**Permisos.** `reservations: read|write`. El Anfitrión tiene `write` limitado a cambios de estado; no edita agenda ni páginas.

**Información visible.** Cabecera con buscador, filtros rápidos y contador. Cada fila/tarjeta:
- Hora y fecha · Nombre del comensal · Número de personas · Teléfono (con acción de llamar/WhatsApp)
- Estado con semáforo de color
- Origen: campaña Meta, Google, directo (icono)
- Indicador de señal enviada a Meta/Google (✓ enviada, ⏱ en cola, ⚠ falló)
- Notas internas si existen (icono)

**Acciones.**
- **Marcar asistencia** — acción primaria, un clic, siempre visible. Es la acción más importante del producto.
- Cambiar estado (menú del semáforo, solo transiciones válidas)
- Ver detalle (panel lateral)
- Reagendar · Agregar nota interna · Crear reserva manual (teléfono/walk-in) · Importar CSV · Exportar

**Filtros rápidos.** Hoy · Mañana · Esta semana · Pendientes de marcar · No asistieron · Por página de reserva · Por origen de campaña.

**Estados.** Ver §13.1. Colores:

| Estado | Etiqueta UI | Color |
|---|---|---|
| `pending` | Pendiente | Ámbar |
| `confirmed` | Confirmada | Cian (`--cian`) |
| `rescheduled` | Reagendada | Cian claro |
| `waitlist` | Lista de espera | Gris |
| `attended` | **Asistió** | Verde |
| `no_show` | No asistió | Rosa (`--rosa`) |
| `cancelled_client` | Cancelada por el comensal | Gris oscuro |
| `cancelled_business` | Cancelada por el local | Gris oscuro |

**Componentes.** `ReservationTable` (escritorio) / `ReservationCardList` (móvil), `StatusTrafficLight`, `QuickFilters`, `SearchBar`, `DetailDrawer`, `ExportModal`, `ImportWizard`, `ManualReservationDialog`.

**APIs.** `GET /reservations` · `PATCH /reservations/:id` · `POST /reservations/manual` · `POST /reservations/import` · `GET /reservations/:id/history` · `GET /reservations/export/csv`.

**Relaciones.** Página de Reserva (origen) · Audiencia (la reserva crea o actualiza el contacto) · Cola de Envíos (el cambio a `attended` encola el evento de conversión) · Cuenta (`clientId`).

---

### 8.3 Calendario

**Objetivo.** Ver la carga en el tiempo, que una tabla no muestra.

**Información visible.** Vistas Mes, Semana y Día.
- **Mes** — por día: total de reservas y barra de ocupación contra el cupo. Días cerrados en gris con patrón rayado.
- **Semana** — franjas horarias × días, con densidad por color.
- **Día** — línea de tiempo con cada reserva ubicada en su hora.

**Acciones.** Clic en un día → bandeja filtrada a ese día · Clic en franja vacía → crear reserva manual con hora precargada · Arrastrar reserva a otra hora → reagendar (con confirmación).

**Componentes.** `CalendarMonth`, `CalendarWeek`, `CalendarDay`, `OccupancyBar`, `ViewSwitcher`.

**APIs.** `GET /reservations?from=&to=` · `GET /public/reservations/:slug/slots` (para conocer cupos y cierres).

---

### 8.4 Agenda

**Objetivo.** Definir cuándo el restaurante recibe reservas y cuánta gente acepta. Es la configuración que hace que la página pública diga "completo" en el momento correcto.

**Usuarios.** Gerente de Cuenta, Operador de Cuentas. **No** el Anfitrión.

**Permisos.** `reservations: write`.

**Información visible.**
- **Horario semanal** — por día: activo/inactivo y sus franjas (ej.: 12:00–15:30, 19:00–23:00).
- **Cupo diario** — **dos topes, ambos vigentes** (ver Anexo D-4): el de la página (`ReservationForm.dailyCapacity`) y el del restaurante completo (`Client.dailyReservationCap`, `0` = sin límite), que suma todas las páginas de la cuenta. La pantalla muestra los dos, señala **cuál está limitando hoy** y advierte cuando el tope de cuenta vuelve irrelevante al de la página.
- **Duración del turno** y anticipación mínima de reserva.
- **Cierres** — fechas o rangos bloqueados, con motivo. Se listan los futuros; los pasados en un desplegable.
- **Vista previa de disponibilidad** — calendario de las próximas 4 semanas mostrando lo que verá el comensal. Es la comprobación de que la configuración hace lo que el usuario cree.

**Acciones.** Editar horario por día · Copiar horario a otros días · Definir cupo · Agregar cierre (fecha, rango o recurrente) · Eliminar cierre · Previsualizar.

**Flujo de cierre.**
```
Agregar cierre → elegir tipo (día completo | franja) → fecha o rango → motivo
  → si hay reservas afectadas: aviso con el número y opción de
     [Cancelar el cierre] o [Cerrar y avisar a los afectados]
  → guardar
```
> **Regla:** un cierre nunca elimina reservas existentes en silencio. O se avisa, o no se cierra.

**Componentes.** `WeeklyScheduleEditor`, `CapacityInput`, `ClosureList`, `ClosureDialog`, `AvailabilityPreview`, `AffectedReservationsWarning`.

**APIs.** `GET|PATCH /reservations/forms/:id` (campo `scheduleConfig`, `dailyCapacity`) · `GET|POST /reservations/forms/:id/blocks` · `POST /reservations/forms/:id/blocks/batch` · `DELETE /reservations/blocks/:id`.

---

### 8.5 Páginas de Reserva

**Objetivo.** Construir y publicar la página pública a la que llegan los avisos.

**Usuarios.** Gerente de Cuenta, Operador de Cuentas.

**Permisos.** `reservations: write`.

**Información visible (listado).** Nombre · Estado (borrador/publicada) · URL pública con botón de copiar · Reservas recibidas (7 y 30 días) · Pixel conectado (sí/no) · Última edición.

**Constructor — cinco pasos con indicador de progreso persistente:**

1. **Identidad** — nombre interno, título público, descripción, dirección, imagen de portada, logo.
2. **Campos** — constructor con arrastrar y soltar (dnd-kit). Los campos obligatorios del sistema (Nombre, Teléfono, Fecha, Personas) llevan candado: se puede renombrar la etiqueta y cambiar el orden, no eliminar. Email es obligatorio si Meta CAPI está activo, y la UI lo explica en el mismo lugar donde se intenta quitar.
3. **Agenda** — atajo embebido a §8.4 para no obligar a salir del flujo.
4. **Diseño** — colores (por defecto la paleta de la cuenta), tipografía, texto de confirmación.
5. **Seguimiento** — Pixel de Meta, ID de medición GA4, activación de CAPI, evento de conversión, valor monetario por reserva.

Cada paso tiene vista previa en vivo a la derecha, con conmutador escritorio/móvil.

**Acciones.** Crear · Duplicar · Publicar/Despublicar · Copiar URL · Ver como comensal · Archivar.

**Estados.** `borrador` → `publicada` → `pausada` → `archivada`.

**Reglas de publicación.** No se puede publicar sin: agenda con al menos un día activo, cupo definido, y —si CAPI está activo— Pixel y token verificados. El botón queda inhabilitado con la lista concreta de lo que falta, cada ítem enlazado a donde se resuelve.

**Componentes.** `FormBuilderDnD`, `FieldLabel` (con candado y edición de etiqueta), `StepProgress`, `LivePreview`, `PublishChecklist`, `DesignPanel`, `TrackingPanel`.

**APIs.** `GET|POST /reservations/forms` · `GET|PATCH /reservations/forms/:id` · `POST /reservations/forms/:id/duplicate` · `GET /public/reservations/:slug`.

---

### 8.6 Audiencia

**Objetivo.** Saber quién come en el restaurante, con qué frecuencia y de qué campaña vino. **Son comensales, no prospectos comerciales.**

**Usuarios.** Gerente de Cuenta, Operador de Cuentas.

**Permisos.** `crm: read|write`. El teléfono y el email completos requieren `crm: write`; con `read` se muestran enmascarados (`+569••••1234`).

**Información visible (listado).** Nombre · Teléfono · Email · Reservas totales · Asistencias · Tasa de asistencia · Última visita · Origen (campaña) · Etiquetas.

**Información visible (ficha).** Datos de contacto; métricas de comportamiento (total, asistencias, inasistencias, ticket estimado); historial completo de reservas con estado; origen de la primera reserva (campaña, conjunto, aviso, si Meta lo entregó); consentimiento de comunicaciones.

**Acciones.** Buscar · Filtrar por origen, tasa de asistencia, última visita · Etiquetar (VIP, recurrente, riesgo) · Editar datos · Exportar · Marcar "no contactar".

**Estados del contacto.** `nuevo` · `recurrente` (≥2 asistencias) · `en_riesgo` (2 inasistencias seguidas) · `inactivo` (sin reservas en 180 días). Se calculan, no se editan a mano.

**Reglas de privacidad.**
- Un contacto pertenece a **una** cuenta. Dos restaurantes con el mismo comensal tienen dos contactos. No hay perfil cruzado entre cuentas: sería compartir datos personales entre clientes distintos.
- Exportar registra un evento de auditoría con quién, cuándo y cuántos registros.
- El borrado responde al webhook de eliminación de datos de Meta ya implementado.

**Componentes.** `AudienceTable`, `ContactDetail`, `ReservationHistory`, `TagPicker`, `MaskedField`, `ExportModal`.

**APIs.** `GET /crm/contacts?clientId=` · `GET|PUT /crm/contacts/:id`. El alta la produce el flujo de reserva; **la creación manual desde esta pantalla no existe** y es correcto que no exista: un comensal entra por una reserva.

> ⚠️ **Comportamiento actual distinto del especificado.** Hoy el contacto se crea solo si el lead resulta `QUALIFIED` (puntaje ≥ 70 en un scoring pensado para prospectos comerciales), y `crm_contacts` **no tiene `client_id`**. Resultado real: la mayoría de los comensales nunca llega a Audiencia, y los que llegan quedan mezclados entre cuentas. Detalle y corrección en el **Anexo D-1**; cambios de datos D6 y D7 en §17.4.

---

### 8.7 Historial de reserva

**Objetivo.** Responder "¿quién cambió esto y cuándo?" sin abrir la base de datos.

**Información visible.** Línea de tiempo por reserva: creación (con origen y datos de match capturados), cada cambio de estado con actor y marca de tiempo, reagendamientos con valor anterior y nuevo, notas internas, y cada evento de conversión con su resultado.

**Componentes.** `Timeline`, `ActorBadge`, `DiffChip`.

**APIs.** `GET /reservations/:id/history` (sobre `reservation_events`).

---

## 9. Señales — Meta y Google (dentro del espacio ◆ OPERACIÓN)

Rutas `/ops/signals/**`. Es la razón de existir de VitaHub y no debe ser un submenú de "Configuración". Vive en Operación porque las señales se generan a partir de reservas reales; el espacio Comercial no las ve ni las necesita.

---

### 9.1 Conexiones

**Objetivo.** Conectar las cuentas publicitarias y saber, de un vistazo, si están sanas.

**Usuarios.** Administrador de Plataforma, Operador de Cuentas. El Gerente de Cuenta ve estado, no tokens.

**Permisos.** `integrations: read|write|admin`. Tokens y secretos: solo `admin`.

**Información visible.** Una tarjeta por proveedor (Meta, Google):
- Estado de conexión (conectada / expirada / desconectada / con error)
- Cuenta publicitaria y Pixel/ID de conversión asociados
- Vencimiento del token, con aviso a 7 días
- Última sincronización
- Cuentas VitaHub que usan esa conexión

**Acciones.** Conectar (OAuth) · Renovar · Desconectar · Asignar Pixel a cuenta · Descubrir cuentas de anuncios · Sincronizar métricas · Probar evento.

**Estados.** `conectada` · `por_vencer` · `expirada` · `error` · `desconectada`.

**Componentes.** `ConnectionCard`, `OAuthButton`, `PixelAssignmentTable`, `TokenExpiryBadge`, `TestEventDialog`.

**APIs.** `GET /integrations` · `POST /integrations` · `PUT /integrations/:id` · `GET /integrations/meta/auth-url`, `/status`, `POST /callback`, `POST /:id/refresh`, `POST /:id/disconnect`, `GET /:id/assets`, `GET /integrations/meta/client-pixels/catalog`, `POST /integrations/meta/client-pixels/setup` · equivalentes en `/integrations/google/*`.

---

### 9.2 Calidad de Señal

**Objetivo.** Que la calidad del emparejamiento sea un número visible y accionable, no un misterio dentro de Meta.

**Usuarios.** Operador de Cuentas, Administrador.

**Permisos.** `integrations: read`.

**Información visible.**
- Puntaje de calidad de emparejamiento por cuenta y por evento (`Schedule`, `Reserva_Asistida`).
- **Cobertura de identificadores** — porcentaje de reservas de los últimos 30 días que incluyeron cada dato: email, teléfono, `fbc`, `fbp`, IP, agente de usuario, país inferido del prefijo telefónico. Es la tabla más útil de la pantalla: dice exactamente qué falta.
- Eventos enviados vs. recibidos por Meta (deduplicación).
- Recomendaciones concretas: "el 40% de tus reservas no trae email → agregarlo como campo obligatorio en la página X" (con enlace directo).

**Acciones.** Ver por cuenta y período · Ejecutar diagnóstico · Enviar evento de prueba · Ir a la página de reserva señalada.

**Componentes.** `MatchQualityGauge`, `CoverageTable`, `RecommendationList`, `DiagnosticsPanel`.

**APIs.** `GET /integrations/meta/:id/health` · `POST /integrations/meta/:id/pixel/validate` · `POST /integrations/meta/:id/conversions/test` · `GET /cron/meta-capi/diagnostics` · `GET /cron/google-ads/diagnostics`.

---

### 9.3 Cola de Envíos

**Objetivo.** Que ningún evento se pierda en silencio, y que cuando falle haya un lugar donde verlo y reintentarlo.

**Usuarios.** Administrador de Plataforma, Operador de Cuentas.

**Permisos.** `integrations: admin`.

**Información visible.** Tabla de eventos encolados: Cuenta · Reserva · Proveedor · Tipo de evento · Estado · Intentos · Próximo reintento · Último error · Creado.

Cabecera con conteos: Pendientes · Enviados hoy · Fallidos · Agotados (máximo de intentos alcanzado).

**Acciones.** Filtrar por estado, proveedor y cuenta · Reintentar ahora (individual o en lote) · Ver la carga útil enviada (con PII enmascarada; el detalle completo requiere `admin` y queda auditado) · Descartar evento agotado con motivo.

**Estados.** `pendiente` → `enviando` → `enviado` | `fallido` (reintentará) | `agotado` (8 intentos, retroceso exponencial 2min→256min) | `descartado`.

**Reglas.**
- Ventana de Meta: un evento con más de 7 días no se envía; se marca `agotado` con motivo "fuera de ventana". La UI lo explica.
- `no_show` **no genera evento de conversión**. La Conversions API no tiene concepto de conversión negativa; enviar algo le diría al algoritmo que esa persona convirtió, que es lo contrario de lo ocurrido. La pantalla debe decirlo donde el operador pueda preguntárselo, no en un comentario del código.

**Componentes.** `QueueTable`, `StatusCounters`, `RetryButton`, `PayloadInspector`, `MaskedJson`.

**APIs.** `GET /integrations/meta/conversions/outbox` · `POST /cron/meta-capi` · `GET /cron/meta-capi` · `POST /cron/meta-capi/cleanup` · `POST|GET /cron/google-ads`.

---

## 10. Análisis — dos conjuntos de reportes, uno por espacio

**No existe un módulo "Reportes" único.** Cada espacio tiene los suyos, con su propia ruta, sus propios datos y su propia audiencia. Un reporte que mezcle reservas y oportunidades sería exactamente la confusión que este PRD elimina.

- `/ops/reports` — Reportes de Operación. Los ve el equipo de operación y el rol `client` (solo su cuenta).
- `/sales/reports` — Reportes Comerciales. Los ve solo el equipo comercial.

**Permisos.** `reports: read`, resuelto por espacio.

### 10.1 Reportes de Operación — `/ops/reports`

- **Resumen** — reservas, comensales, tasa de asistencia, tasa de cancelación, ocupación media del cupo. Comparación con el período anterior.
- **Por origen** — reservas y asistencia segmentadas por campaña / conjunto / aviso, donde Meta entrega el dato.
- **Por página de reserva** — cuál convierte mejor.
- **Por día y franja horaria** — mapa de calor de demanda.
- **Comportamiento de la audiencia** — nuevos vs. recurrentes, frecuencia de visita.

### 10.2 Reportes Comerciales — `/sales/reports`

- **Embudo** — conversión entre etapas y tiempo medio en cada una.
- **Cierre** — tasa por ejecutivo, por origen y por rango de monto.
- **Pérdidas** — distribución de motivos.
- **Forecast** — ponderado por mes, contra objetivo.

### 10.3 Exportaciones

Modal común a toda la plataforma: rango de fechas, formato (CSV/JSON/PDF), selección de campos con casillas, y aviso explícito cuando la selección incluye datos personales. La exportación queda en auditoría.

**Componentes.** `ReportShell`, `DateRangePicker`, `ComparisonToggle`, `ChartCard`, `HeatMap`, `ExportModal`, `PiiWarningBanner`.

**APIs.** `GET /reservations/analytics/metrics` · `POST /reservations/forms/:formId/export` · `GET /reports/*`.

---

## 11. Espacio ◆ PLATAFORMA — administración

**Ruta base `/admin` · acento gris · solo `admin` (lectura para `operations_director`).**

### 11.1 Usuarios

**Información visible.** Nombre · Email · Rol · **Espacios habilitados** · Cuenta asignada (si aplica) · Estado · Último acceso · 2FA.
**Acciones.** Invitar · Editar rol · **Conceder o quitar acceso a un espacio** · Asignar cuenta · Forzar cambio de contraseña · Desactivar (nunca borrar: rompe la auditoría).
**Reglas.** El acceso a espacio es una casilla explícita por usuario, derivada del rol pero sobreescribible; es lo primero que se ve en la ficha, porque determina qué producto usa esa persona. Un usuario `client` **debe** tener `clientId`. Sin él, no puede iniciar sesión — un usuario de cuenta sin cuenta no tiene ámbito, y un ámbito indefinido en multi-tenant es una filtración esperando ocurrir.

### 11.2 Módulos

**Objetivo.** Encender y apagar funcionalidad por organización y por cuenta.
**Información visible.** Matriz módulo × cuenta con el estado de cada capability (`reservations`, `crm`, `metaConversions`, `googleConversions`).
**Reglas.** `metaConversions` y `googleConversions` envían datos personales a terceros: se activan de a una, con confirmación explícita, y el cambio queda auditado con actor y momento.

### 11.3 Registro de Auditoría

**Información visible.** Actor · Acción · Entidad · Cuenta · Momento · IP · Antes/Después.
**Acciones.** Filtrar por actor, entidad, tipo y rango. Exportar.
**Eventos obligatorios.** Cambio de capability · Exportación de datos personales · Cambio de rol · Conexión/desconexión de integración · Consulta de carga útil con PII · Borrado de datos por solicitud de Meta.

### 11.4 Tareas Programadas

**Objetivo.** Que el operador vea si el cron de cPanel está corriendo, sin entrar a cPanel.
**Información visible.** Tarea · Última ejecución · Duración · Resultado · Elementos procesados · Próxima esperada.
**Tareas.** `meta-capi` (cada 5 min) · `google-ads` · `meta-capi/cleanup` · barrido comercial diario (SLA, vigencias, recordatorios).
**Alerta.** Si una tarea no se ejecuta en el doble de su intervalo, banner rojo persistente en Inicio para los roles de administración.

---

## 12. Handoff: de Oportunidad Ganada a Cuenta Activa

Este es **el único punto donde los dos espacios se tocan**, y el único lugar de la aplicación donde una acción iniciada en `/sales` produce un efecto en `/ops`. Está definido al detalle justamente para que sea el único.

**Cruce de espacio en la interfaz.** El handoff nace en Comercial y termina en Operación. La transición es explícita, nunca automática:

```
[◆ COMERCIAL]  Oportunidad → Ganada → diálogo de cierre → [Crear cuenta]
        │
        ▼
┌────────────────────────────────────────────────────┐
│  ✓ Cuenta creada: «Restaurante Del Puerto»         │
│                                                    │
│  La cuenta ya existe en el espacio Operación.      │
│  El onboarding lo continúa el Operador asignado.   │
│                                                    │
│  [Seguir en Comercial]   [Ir a Operación →]        │
└────────────────────────────────────────────────────┘
```

El ejecutivo comercial decide si cruza. Si cruza, el cambio de espacio ocurre con la transición completa de §15.0 y aterriza en la ficha de la cuenta recién creada. Si no tiene acceso a Operación, el botón no aparece y en su lugar se indica quién es el responsable del onboarding.

### 12.1 Flujo

```
Oportunidad en Negociación
        │
        │  el ejecutivo la mueve a GANADA
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Diálogo «Cerrar venta» — obligatorio, no omitible           │
│                                                             │
│  1. Confirmar monto final y fecha de inicio                 │
│  2. Vincular contrato (o crearlo desde la cotización)       │
│  3. Datos operativos del restaurante:                       │
│     • Nombre comercial   • Zona horaria                     │
│     • Dirección          • Cupo diario inicial              │
│  4. Asignar Operador de Cuentas responsable                 │
│  5. Módulos iniciales: Reservas ☑  Audiencia ☑              │
│     Meta CAPI ☐  Google ☐  (apagados a propósito)          │
│                                                             │
│              [Cancelar]   [Crear cuenta]                    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼  transacción única
┌─────────────────────────────────────────────────────────────┐
│ El sistema, en una sola transacción:                        │
│  • Crea la Cuenta (client) en estado ONBOARDING             │
│  • Vincula opportunity.clientId → nueva cuenta              │
│  • Marca la Empresa como «cliente»                          │
│  • Aplica capabilities por defecto                          │
│  • Crea el checklist de onboarding                          │
│  • Mueve la oportunidad a Implementación                    │
│  • Registra el evento en auditoría                          │
│  Si algo falla: revierte todo. No hay estados a medias.    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Onboarding — lo ejecuta el Operador de Cuentas              │
│  ☐ Crear usuario Gerente de Cuenta                          │
│  ☐ Configurar Agenda (horarios, cupo)                       │
│  ☐ Crear la primera Página de Reserva                       │
│  ☐ Conectar Pixel de Meta y token de CAPI                   │
│  ☐ Activar capability metaConversions                       │
│  ☐ Reserva de prueba con evento verificado en Meta          │
│  ☐ Publicar la página                                       │
│  ☐ Capacitación al equipo del restaurante                   │
└─────────────────────────────────────────────────────────────┘
        │  al completar el checklist y recibir la primera reserva real
        ▼
   Cuenta ACTIVE — la oportunidad pasa a «Cuenta Activa» y sale del pipeline
```

### 12.2 Reglas del handoff

| # | Regla |
|---|---|
| H1 | Una oportunidad ganada **siempre** produce una cuenta. No existe "ganada sin cuenta". |
| H2 | Una cuenta **siempre** tiene origen: la oportunidad que la creó, o "alta manual" con actor registrado. |
| H3 | El vínculo es 1:1 y se guarda en `opportunity.clientId` (el campo ya existe). |
| H4 | **Los datos comerciales no viajan.** Ni la cotización, ni las actividades, ni las notas de venta entran al dominio Operación. Se consultan desde la ficha de Cuenta mediante un enlace a la Empresa, visible solo para roles internos. |
| H5 | **Los datos operativos no vuelven.** Las reservas y los comensales no aparecen jamás en Ventas. En el Panel Comercial se ve, como mucho, un indicador agregado de salud de la cuenta ("activa / en riesgo"), nunca un comensal. |
| H6 | Las capabilities que envían datos personales nacen apagadas, incluso si el contrato las incluye. Se encienden cuando la conexión está probada. |
| H7 | Si el contrato termina, la cuenta pasa a `CHURNED` y sus páginas se despublican automáticamente. Los datos se conservan según la política de retención; no se borran al terminar el contrato. |

### 12.3 Lo que el handoff **no** hace

- No copia contactos comerciales a Audiencia. Un gerente de restaurante no es un comensal.
- No crea reservas de ejemplo. Datos falsos en producción contaminan los reportes y las señales que se envían a Meta.
- No conecta integraciones automáticamente. Conectar Meta requiere OAuth con una persona presente.

---

## 13. Máquinas de estado

### 13.1 Reserva

Refleja exactamente `STATUS_TRANSITIONS` en `reservations.service.ts`. Es normativo: la UI solo ofrece transiciones válidas.

```
                    ┌──────────────┐
                    │   pending    │  creada desde la página pública
                    └──────┬───────┘
        ┌──────────────────┼──────────────────┬─────────────────┐
        ▼                  ▼                  ▼                 ▼
  ┌───────────┐     ┌────────────┐   ┌──────────────────┐  ┌──────────┐
  │ confirmed │◄───►│ waitlist   │   │ cancelled_client │  │cancelled │
  └─────┬─────┘     └─────┬──────┘   └──────────────────┘  │_business │
        │                 │                                 └──────────┘
        │  ┌──────────────┘
        ▼  ▼
  ┌─────────────┐
  │ rescheduled │
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────┐
│attended │ │ no_show │   ← estados finales
└─────────┘ └─────────┘
```

| Transición | Efecto colateral |
|---|---|
| creación | Encola evento `Schedule` · `LeadIntakeService` crea/actualiza el contacto de Audiencia |
| `→ attended` | Encola evento `Reserva_Asistida` con valor opcional · actualiza el contacto |
| `→ no_show` | **No encola evento** (§9.3) · actualiza el contacto |
| `waitlist → confirmed` | Revalida disponibilidad contra el cupo antes de aceptar |
| cualquiera | Escribe una fila en `reservation_events` |

### 13.2 Oportunidad

```
Prospecto → Contactado → Calificación → Reunión → Demo → Propuesta → Negociación → Ganada → Implementación → Cuenta Activa
    │           │             │            │        │         │            │
    └───────────┴─────────────┴────────────┴────────┴─────────┴────────────┴────────► Perdida
```
- Retroceder una etapa está permitido y exige nota (los tratos retroceden en la vida real; ocultarlo produce pipelines falsos).
- Desde `Ganada` no se retrocede: ya hay una cuenta creada.
- `Perdida` es reabrible: vuelve a `Contactado` con nota obligatoria.

### 13.3 Empresa (comercial)

`prospecto → en_conversacion → calificada → cliente | descartada`
`cliente` lo escribe solo el handoff.

### 13.4 Cuenta

Coincide con `ClientStatus` existente: `ONBOARDING → ACTIVE → PAUSED | AT_RISK → CHURNED`.
`AT_RISK` se calcula: sin reservas en 14 días, o tasa de asistencia bajo 40% en 30 días.

### 13.5 Evento de conversión

`pendiente → enviando → enviado | fallido → (reintento) → agotado | descartado`

### 13.6 Contacto de Audiencia

`nuevo → recurrente | en_riesgo → inactivo`. Calculado, nunca editado a mano.

---

## 14. Flujos end-to-end

### 14.1 Flujo del comensal (el que genera el valor)

```
Ve un aviso en Instagram/Facebook
   ↓ clic (la URL trae fbclid)
Página de Reserva pública  /r/{slug}
   ↓ el Pixel dispara PageView y captura _fbc/_fbp
Elige fecha y hora
   ↓ GET /public/reservations/{slug}/slots → solo horarios con cupo
Completa nombre, teléfono, email, personas
   ↓ POST /public/reservations/{slug}
   ├─ valida cupo diario y cierres
   ├─ crea la Reserva con los datos de emparejamiento (fbc, fbp, IP, agente, gclid)
   ├─ encola el evento «Schedule» en la Cola de Envíos
   └─ LeadIntakeService crea el contacto en Audiencia
Pantalla de confirmación (+ agregar a calendario)
   ↓
[cron cada 5 min] procesa la cola → Meta CAPI recibe «Schedule»
   ↓
Llega el día. El comensal se sienta a la mesa.
   ↓
El Anfitrión abre Reservas y toca «Asistió»
   ↓ PATCH /reservations/{id} status=attended
   ├─ encola «Reserva_Asistida» con valor
   └─ actualiza el contacto de Audiencia
   ↓
[cron] → Meta recibe la conversión real
   ↓
El algoritmo aprende. Reportes muestran ROAS sobre asistencia, no sobre clics.
```

### 14.2 Flujo del Gerente de Cuenta

```
Inicia sesión → Inicio: reservas de hoy y pendientes de marcar
   ↓
Agenda → define horario semanal y cupo diario
   ↓
Cierres → bloquea el 18 de septiembre (con aviso de reservas afectadas)
   ↓
Páginas de Reserva → construye, previsualiza, publica
   ↓
Reservas → opera el día, marca asistencia
   ↓
Audiencia → identifica recurrentes, etiqueta VIP
   ↓
Reportes → asistencia por campaña, decide dónde invertir
```

### 14.3 Flujo del Ejecutivo Comercial

```
Inicia sesión → Panel Comercial: qué requiere atención hoy
   ↓
Empresas → crea la empresa prospecto
   ↓
Contactos → registra al decisor
   ↓
Pipeline → crea la oportunidad (Prospecto)
   ↓
Actividades → registra llamada; crea tarea de seguimiento
   ↓
Cotizaciones → arma desde el catálogo, envía → la oportunidad pasa a Propuesta
   ↓
Negociación → ajusta y cierra
   ↓
Ganada → diálogo de cierre → se crea la Cuenta (§12)
   ↓
La oportunidad queda en Implementación; el Operador de Cuentas toma el onboarding
```

### 14.4 Flujo del Administrador de Plataforma

```
Inicio → alertas: crones caídos, envíos agotados, tokens por vencer
   ↓
Conexiones → renueva el token de Meta que vence en 5 días
   ↓
Calidad de Señal → detecta cobertura de email en 55% para la cuenta X
   ↓ enlace directo
Páginas de Reserva de X → marca Email como obligatorio
   ↓
Cola de Envíos → reintenta 12 eventos fallidos por token vencido
   ↓
Auditoría → verifica quién activó metaConversions en la cuenta Y
   ↓
Tareas Programadas → confirma que meta-capi corrió hace 3 minutos
```

### 14.5 Flujo del Operador de Cuentas (onboarding)

```
Cuentas → ficha de la nueva cuenta en ONBOARDING
   ↓
Checklist: crea el usuario Gerente
   ↓ configura Agenda base con el restaurante en llamada
   ↓ crea la primera Página de Reserva
   ↓ Conexiones → asigna Pixel y token de CAPI
   ↓ activa metaConversions
   ↓ Diagnóstico → reserva de prueba → verifica el evento en Meta
   ↓ publica la página
   ↓ capacita al equipo
   ↓
Llega la primera reserva real → la cuenta pasa a ACTIVE
```

---

## 15. Diseño de experiencia por pantalla

Convención: cada pantalla se describe como **estructura · comportamiento · estados vacíos y de error · comportamiento móvil**.

---

### 15.0 Cambio de espacio

Es la interacción que sostiene toda la separación. Debe ser inequívoca.

**Estructura.** Barra de 48px al tope del sidebar, con el color del espacio actual, su icono, su nombre en versalitas y una flecha. Al hacer clic se despliega un panel de 320px con las tres opciones (o las que el usuario tenga).

**Comportamiento.**
- La transición es una **cortina de 180ms**: el sidebar se desvanece hacia el color del espacio destino y vuelve con el menú nuevo. No es adorno: marca corporalmente que se cambió de producto, en vez de que el menú parezca haberse reordenado solo.
- Durante la transición, el contenido muestra el esqueleto del Inicio destino. No queda la pantalla anterior visible bajo un menú nuevo — la combinación de menú nuevo con contenido viejo es exactamente la lectura errónea que hay que impedir.
- El título de la pestaña del navegador cambia en el mismo momento.
- Si el usuario tenía filtros o una búsqueda activa, se descartan. Un filtro de Comercial no significa nada en Operación.

**Estados.**
- Un solo espacio disponible → la barra no es interactiva y muestra el nombre del espacio sin flecha (o el logo del restaurante, para el rol `client`).
- Sin conexión al cambiar → permanece en el espacio actual con un aviso; nunca deja al usuario en un espacio a medio cargar.

**Móvil.** El selector es la cabecera del drawer, a ancho completo y con el color del espacio. Al elegir, el drawer se cierra y aterriza en el Inicio del espacio destino.

**Componentes.** `WorkspaceSwitcher`, `WorkspaceBadge`, `WorkspaceTransition`, `WorkspaceContext`.

---

### 15.1 Página pública de reserva `/r/{slug}`

Es la única pantalla que ve un cliente final. Su tasa de conversión es la métrica del producto.

**Estructura.** Una columna, máximo 560px, centrada.
```
┌──────────────────────────────────────┐
│  [imagen de portada]                 │
│  [logo]  Nombre del restaurante      │
│  Dirección · enlace a mapa           │
├──────────────────────────────────────┤
│  ① ¿Cuándo?                          │
│  [ calendario compacto: 4 semanas ]  │
│  Días sin cupo en gris, no clicables │
│                                      │
│  Horarios del día elegido:           │
│  [12:30] [13:00] [13:30] [14:00]     │
│  (los sin cupo, tachados)            │
├──────────────────────────────────────┤
│  ② ¿Cuántos son?                     │
│  [ − ]  4 personas  [ + ]            │
├──────────────────────────────────────┤
│  ③ ¿Quién reserva?                   │
│  Nombre     [__________________]     │
│  Teléfono   [+56 9 ____ ____]        │
│  Email      [__________________]     │
│  Comentario [__________________]     │
├──────────────────────────────────────┤
│        [  Confirmar reserva  ]       │
│  Al reservar aceptas … (legal breve) │
└──────────────────────────────────────┘
```

**Comportamiento.**
- Los tres pasos están en una sola página, sin navegación entre pantallas: cada paso adicional pierde gente.
- La selección de fecha carga los horarios sin recargar la página; mientras carga, esqueletos, no un spinner que borra el contexto.
- Validación al salir de cada campo, no al enviar. Teléfono con formato automático y prefijo por defecto según la zona horaria de la cuenta.
- El botón muestra "Reservando…" y se inhabilita al enviar. Doble envío imposible.
- Confirmación **en la misma página** (no redirección): número de reserva, resumen, botón "Agregar al calendario", y —solo si la cuenta lo configuró— código de descuento.

**Vacíos y errores.**
- Sin cupo en las próximas 4 semanas: "Por ahora no hay horarios disponibles" con teléfono del local. Nunca un calendario vacío sin explicación.
- El horario se ocupó mientras completaba: aviso en línea, refresco de horarios, sin perder lo escrito. Perder un formulario completo por una carrera de concurrencia es la peor experiencia posible en esta pantalla.
- Error de red: reintento, con los datos preservados.

**Móvil.** Es el caso principal: el tráfico viene de Instagram. Objetivo de pulsación 44px, teclado numérico para teléfono, botón de confirmar fijo al pie tras el primer desplazamiento.

---

### 15.2 Reservas (bandeja)

**Estructura.**
```
┌───────────────────────────────────────────────────────────────────────┐
│ Reservas                    [Nueva reserva] [Importar] [Exportar]     │
├───────────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar por nombre o teléfono            ]  [Página ▾] [Estado ▾]  │
│ ( Hoy ) ( Mañana ) ( Esta semana ) ( Sin marcar ) ( No asistió )      │
├───────────────────────────────────────────────────────────────────────┤
│ Hoy · 14 reservas · 47 comensales · 6 sin marcar                      │
├───────────────────────────────────────────────────────────────────────┤
│ 13:00 │ María Fernández  │ 4 pers │ ● Confirmada │ ⚡Meta │ [Asistió] ⋮│
│ 13:30 │ Carlos Rojas     │ 2 pers │ ● Pendiente  │       │ [Asistió] ⋮│
│ 14:00 │ Ana Pérez        │ 6 pers │ ● Asistió ✓  │ ⚡Meta │           ⋮│
└───────────────────────────────────────────────────────────────────────┘
```

**Comportamiento.**
- Agrupada por día, con encabezado fijo por grupo al desplazar.
- **"Asistió" es un botón, no una opción de menú.** Es la acción del producto: pedirle dos clics al anfitrión durante el servicio es perderla.
- El semáforo abre un menú con las transiciones válidas para ese estado. Nunca se ofrecen las inválidas: un error que el sistema rechazará no debe ser ofrecible.
- Clic en la fila abre panel lateral (420px) sin abandonar la lista.
- Actualización optimista con reversión y aviso si el servidor rechaza.
- Filtros en la URL: la vista se comparte y se marca como favorita.

**Panel lateral de detalle.** Cabecera con nombre, estado y hora; pestañas: Detalle (datos, personas, comentario, origen de campaña), Notas internas, Historial (línea de tiempo), Señales (eventos enviados con su resultado). Acciones al pie: Marcar asistencia · Reagendar · Cancelar.

**Vacíos.** Sin reservas hoy: ilustración discreta, "Sin reservas para hoy" y —si no hay página publicada— "Publicá tu página de reserva para empezar a recibirlas" con enlace. El estado vacío es una oportunidad de guiar, no un espacio en blanco.

**Móvil.** Tarjetas apiladas; "Asistió" a ancho completo; deslizar a la derecha marca asistencia, a la izquierda abre el detalle.

---

### 15.3 Calendario

**Estructura.** Barra superior con conmutador Mes/Semana/Día, navegación de período y "Hoy". Cuadrícula principal. Panel lateral derecho con el resumen del día seleccionado.

**Comportamiento.** Color por ocupación (0% claro → 100% cian saturado). Días cerrados con patrón rayado y su motivo al pasar el cursor. Arrastrar una reserva a otro horario pide confirmación, revalida cupo y registra el reagendamiento.

**Móvil.** Solo vista Día con desplazamiento horizontal entre días; la vista Mes se degrada a una lista por día.

---

### 15.4 Agenda

**Estructura.** Dos columnas: configuración a la izquierda (60%), vista previa de disponibilidad a la derecha (40%, fija al desplazar).

```
┌── Horario semanal ─────────────────┐  ┌── Vista previa ────────┐
│ Lunes     [○ cerrado]              │  │  Lo que verá tu cliente│
│ Martes    [● abierto]              │  │  [calendario 4 semanas]│
│   12:00–15:30  [×]                 │  │  ✓ con cupo            │
│   19:00–23:00  [×]                 │  │  ✗ completo            │
│   + agregar franja                 │  │  ▨ cerrado             │
│   [copiar a otros días ▾]          │  └────────────────────────┘
│ …                                  │
├── Cupo ────────────────────────────┤
│ Máximo por día: [60] comensales    │
│ Duración del turno: [90] min       │
│ Anticipación mínima: [2] horas     │
├── Cierres ─────────────────────────┤
│ 18 sep — Fiestas Patrias   [×]     │
│ 25 dic — Navidad           [×]     │
│ + agregar cierre                   │
└────────────────────────────────────┘
```

**Comportamiento.** La vista previa se actualiza al cambiar cualquier valor, antes de guardar: el usuario ve la consecuencia mientras decide. Barra fija al pie con "Guardar" cuando hay cambios sin guardar, y aviso al intentar salir.

---

### 15.5 Constructor de Página de Reserva

**Estructura.** Tres zonas: pasos a la izquierda (200px), editor al centro, vista previa a la derecha (380px, conmutador escritorio/móvil).

**Comportamiento del paso "Campos".** Lista ordenable con manija visible (⋮⋮). Al arrastrar: el elemento se eleva con sombra y opacidad 0.8, y una línea cian marca dónde caerá. Los campos con candado se pueden mover pero no eliminar; al intentarlo, un mensaje explica por qué existe la restricción ("Meta necesita el teléfono para reconocer a la persona"). Panel de edición en línea por campo: etiqueta, texto de ayuda, obligatorio, valores si es lista.

**Publicación.** El botón "Publicar" queda inhabilitado con la lista de lo que falta, cada línea enlazada a donde se resuelve. Nunca un botón muerto sin explicación.

---

### 15.6 Pipeline

**Estructura.** Kanban de desplazamiento horizontal, columnas de 300px. Cabecera de columna con nombre, cantidad y monto.

**Comportamiento.** Al arrastrar, las columnas destino válidas se resaltan y las inválidas se atenúan. Soltar en "Ganada" abre el diálogo de cierre; en "Perdida", el de motivo. Las columnas Implementación y Cuenta Activa tienen fondo tenue y borde punteado: son territorio del otro dominio.

**Móvil.** El Kanban no funciona en móvil. Se sustituye por lista agrupada por etapa con secciones plegables y cambio de etapa por menú.

---

### 15.7 Ficha de Cuenta

**Estructura.** Cabecera con logo, nombre, estado, responsable y accesos rápidos (ver página pública, ir a reservas). Pestañas: Información · Módulos · Conexiones · Páginas · Agenda · Facturación · Historial.

**Detalle relevante.** En la pestaña Información, para roles internos, una tarjeta discreta "Origen comercial" con enlace a la Empresa y la oportunidad que la generó. Es el único puente visible entre dominios, y por eso se muestra como referencia, no como datos incrustados.

---

### 15.8 Cola de Envíos

**Estructura.** Contadores arriba (Pendientes · Enviados hoy · Fallidos · Agotados), tabla densa abajo, panel lateral con la carga útil.

**Comportamiento.** Los fallidos se ordenan primero. Un error repetido en varias filas se agrupa con un banner ("14 eventos fallaron por token expirado — Renovar conexión"), que es la acción que realmente resuelve el problema. Reintentar en lote muestra progreso, no un spinner opaco.

**Inspector de carga útil.** JSON formateado con los campos de PII enmascarados por defecto y un botón "Mostrar datos personales" que exige `admin` y escribe en auditoría.

---

### 15.9 Calidad de Señal

**Estructura.** Medidor de calidad arriba, tabla de cobertura de identificadores al centro, recomendaciones abajo.

**Comportamiento.** La tabla de cobertura es la pieza central: una fila por identificador, con barra de porcentaje y, cuando está bajo el umbral, un botón que lleva exactamente a la pantalla donde se corrige. Un diagnóstico que no ofrece la acción correctiva es un reproche, no una herramienta.

---

### 15.10 Ajustes

Tres pestañas: **Perfil** (nombre, email, avatar), **Seguridad** (contraseña con medidor de fuerza, 2FA, sesiones activas), **Preferencias** (idioma, zona horaria, notificaciones, sidebar colapsado por defecto). Validación en línea, guardado por sección, aviso de éxito.

---

## 16. Sistema de diseño y componentes

### 16.1 Paleta

```css
:root {
  --cian: #0EC6B8;        /* primario: acciones, selección, marca */
  --cian-dark: #0AA79B;
  --rosa: #EA0F63;        /* acento: destructivo, no asistió, alertas */
  --rosa-dark: #C50B52;

  --exito: #16A34A;       /* asistió */
  --alerta: #F59E0B;      /* pendiente */
  --neutro: #8A8D95;      /* cancelado, inactivo */

  --txt: #0B0B0C;
  --txt-secondary: #55575E;
  --txt-muted: #8A8D95;
  --line: #E7E8EC;
  --gray: #F4F5F7;
  --blanco: #FFFFFF;
  --dark-card: #131316;
}
```

**Regla de uso.** El cian es la única acción primaria de una pantalla. El rosa es para destructivo y para "no asistió". El verde de éxito es exclusivo de "asistió": es el estado que el producto persigue y debe reconocerse sin leer.

### 16.2 Inventario de componentes compartidos

| Componente | Usado en |
|---|---|
| `AppShell` (sidebar + cabecera + contenido) | Todas |
| `Sidebar` (colapsable, por secciones, selector de cuenta) | Todas |
| `PageHeader` (título, migas, acciones) | Todas |
| `DataTable` (orden, selección, columnas, paginación) | Reservas, Audiencia, Oportunidades, Usuarios, Cola |
| `StatCard` | Inicio, Paneles |
| `StatusTrafficLight` | Reservas |
| `StatusBadge` | Oportunidades, Cotizaciones, Cuentas, Cola |
| `DetailDrawer` | Reservas, Audiencia, Cola |
| `TabbedDetail` | Cuenta, Empresa |
| `Timeline` | Historial, Actividades |
| `ExportModal` | Reservas, Audiencia, Oportunidades, Reportes |
| `ImportWizard` | Reservas |
| `DateRangePicker` | Reportes, filtros |
| `KanbanBoard` (dnd-kit) | Pipeline |
| `FormBuilderDnD` (dnd-kit) | Páginas de Reserva |
| `StepProgress` | Constructor, Onboarding |
| `EmptyState` | Todas |
| `NotificationCenter` + `toast()` | Global |
| `ConfirmDialog` | Acciones destructivas |
| `MaskedField` | Audiencia, Cola |
| `Icons` (react-icons / Font Awesome) | Global — **cero emojis en la interfaz** |

### 16.3 Reglas transversales de interacción

1. **Toda acción da respuesta en menos de 100ms**, aunque sea un estado de carga. El silencio se interpreta como fallo.
2. **Toda acción destructiva pide confirmación** nombrando lo que se destruye ("Eliminar la página *Reservas Almuerzo*").
3. **Todo estado vacío ofrece la acción siguiente.** No hay pantallas vacías sin salida.
4. **Todo error dice qué pasó y qué hacer**, en español, sin códigos de excepción visibles.
5. **Todo listado con más de 50 filas pagina** en el servidor.
6. **Todo formulario largo avisa al salir con cambios sin guardar.**
7. **Toda pantalla funciona a 375px de ancho.**
8. **Contraste mínimo AA (4.5:1)** y navegación completa por teclado en la bandeja de reservas y la página pública.

---

## 17. Modelo de datos lógico

**No se rediseña el esquema.** Se agrupa lo existente por dominio y se señalan los cambios mínimos que la separación exige.

### 17.1 Agrupación por dominio

```
DOMINIO COMERCIAL
  crm_leads                 → Empresas prospecto
  crm_contacts (comercial)  → Contactos comerciales
  crm_opportunities         → Oportunidades
  crm_interactions          → Actividades y tareas
  catalog_services/packs    → Catálogo
  catalog_quotes            → Cotizaciones
  contracts                 → Contratos
  documents (ámbito ventas) → Documentos comerciales

DOMINIO OPERACIÓN
  clients                   → Cuentas
  reservation_forms         → Páginas de Reserva
  reservations              → Reservas
  reservation_events        → Historial
  availability_blocks       → Cierres
  reservation_coupons       → Cupones
  crm_contacts (audiencia)  → Comensales

DOMINIO SEÑALES
  integrations              → Conexiones
  integration_accounts      → Cuentas publicitarias y pixeles
  integration_metrics       → Métricas importadas
  meta_conversion_outbox    → Cola Meta
  google_conversion_outbox  → Cola Google

TRANSVERSAL
  organizations, users, audit_log, parameters, notifications
```

### 17.2 Relaciones clave

```
Organization (La Vitamina)
 ├─ Lead/Empresa 1─N Opportunity ──1:1──► Client/Cuenta
 │                        │                    │
 │                        └─ Quote ─ Contract ─┘
 │
 └─ Client/Cuenta 1─N ReservationForm 1─N Reservation
                            │                  │
                            │                  ├─ ReservationEvent
                            │                  ├─ MetaConversionOutbox
                            │                  └─ Contact (Audiencia)
                            └─ AvailabilityBlock
```

### 17.3 Regla de aislamiento multi-tenant

Toda consulta del dominio Operación filtra por `organizationId` **y** por `clientId` cuando el actor es de ámbito cuenta. Ya lo resuelve `core/client-scope`; el PRD lo declara requisito de aceptación, no detalle de implementación. Es además el módulo con menor cobertura de tests (5.6%): dado lo que protege, es donde más conviene subirla.

### 17.4 Cambios mínimos propuestos

Cinco cambios. Ninguno rediseña tablas; todos son necesarios para que la separación de dominios sea real y no solo visual.

| # | Cambio | Tabla | Justificación | Riesgo |
|---|---|---|---|---|
| D1 | Columna `domain enum('commercial','audience')`, por defecto `'audience'` | `crm_contacts` | Sin discriminador, Contactos Comerciales y Audiencia comparten tabla y se contaminan mutuamente. Es el cambio que hace posible la separación. | Bajo — migración con valor por defecto |
| D2 | Columna `pipeline_stage varchar(50)` separada de `status` | `crm_leads` | Separa el ciclo comercial del de reservas hoy mezclados en `LeadStatus` (§2.2). `status` queda para el ciclo de reservas y `pipeline_stage` para el comercial. | Medio — requiere relleno de datos y actualizar consultas |
| D3 | Columnas `due_at`, `assigned_to`, `completed_at` | `crm_interactions` | Distingue Tarea (futura, con vencimiento) de Actividad (pasada). Sin esto no hay recordatorios comerciales. | Bajo — columnas nulas |
| D4 | Columna `source_opportunity_id` | `clients` | Trazabilidad del handoff. **`clients.lead_id` ya existe** y vincula la cuenta con la Empresa; lo que falta es el vínculo con la **oportunidad** concreta que la generó, porque una empresa puede producir más de una. | Bajo |
| D5 | Columna `loss_reason varchar(50)` | `crm_opportunities` | El reporte de pérdidas es inútil sin motivo estructurado. | Bajo |
| **D6** | **Columna `client_id uuid` + índice** | `crm_contacts` | **`crm_contacts` no tiene `client_id`.** Hoy los comensales de todos los restaurantes conviven en una sola tabla sin separación por cuenta: la regla de aislamiento de §8.6 y §17.3 **no se cumple**. Es el cambio más urgente de los siete. | Medio — requiere relleno vía `lead_id → lead.client_id` |
| **D7** | **Columna `domain enum('commercial','audience')` en `crm_leads`** | `crm_leads` | Las reservas escriben en la misma tabla que las empresas prospecto (ver Anexo D-1). Sin discriminador, el embudo comercial cuenta comensales. | Medio |

Migraciones numeradas siguiendo la convención existente (siguiente disponible tras `0058`), TypeORM, MySQL, sin dependencias nuevas.

---

## 18. Mapa de APIs

### 18.1 Existentes — se conservan

| Dominio | Endpoints |
|---|---|
| Público | `GET /public/reservations/:slug` · `GET /public/reservations/:slug/slots` · `POST /public/reservations/:slug` · `POST /public/reservations/:slug/events` · `POST /public/reservations/:slug/coupon-validate` |
| Reservas | `GET /reservations` · `PATCH /reservations/:id` · `POST /reservations/manual` · `POST /reservations/import` · `GET /reservations/:id/history` · `GET /reservations/export/csv` · `GET /reservations/analytics/metrics` |
| Páginas | `GET|POST /reservations/forms` · `GET|PATCH /reservations/forms/:id` · `POST /reservations/forms/:id/duplicate` · `POST /reservations/forms/:formId/export` |
| Agenda | `GET|POST /reservations/forms/:id/blocks` · `POST /reservations/forms/:id/blocks/batch` · `DELETE /reservations/blocks/:id` |
| Cupones | `GET|POST /reservations/coupons` · `PATCH /reservations/coupons/:id` |
| Comercial | `GET|POST /crm/leads` · `GET|PATCH /crm/leads/:id` · `POST /crm/leads/:id/convert` · `GET|POST|PATCH|DELETE /crm/opportunities` · `GET|POST|PUT|DELETE /crm/interactions` · `GET|POST|PUT|DELETE /crm/contacts` |
| Catálogo | `GET /catalog/services` · `/catalog/packs` · `GET|POST /catalog/quotes` |
| Contratos | `GET|POST|PATCH /contracts` |
| Cuentas | `GET|POST /clients` · `GET /clients/:id` |
| Meta | `GET /integrations/meta/auth-url` · `/status` · `POST /callback` · `POST /:id/refresh` · `POST /:id/disconnect` · `GET /:id/assets` · `GET /:id/health` · `POST /:id/pixel/validate` · `POST /:id/conversions/test` · `GET /integrations/meta/conversions/outbox` · `GET|POST /integrations/meta/:id/client-pixels` · `POST /integrations/meta/client-pixels/setup` |
| Google | `GET /integrations/google/auth-url` · `/status` · `POST /callback` · `POST /:id/ads/discover` · `POST /:id/data/sync` |
| Cron | `POST|GET /cron/meta-capi` · `GET /cron/meta-capi/diagnostics` · `POST /cron/meta-capi/cleanup` · `POST|GET /cron/google-ads` · `GET /cron/google-ads/diagnostics` |
| Webhooks | `POST /webhooks/meta` · `POST /webhooks/meta/data-deletion` |

### 18.2 Nuevos — solo agregación y los conectores del handoff

| Endpoint | Propósito | Nota |
|---|---|---|
| `GET /reports/commercial/summary` | Alimenta el Panel Comercial | Solo agrega sobre tablas existentes |
| `POST /crm/opportunities/:id/win` | Ejecuta el handoff transaccional (§12) | Reemplaza el cambio de etapa suelto a `Ganada` |
| `POST /crm/opportunities/export` | Exportación | Reutiliza el servicio de exportación existente |
| `GET /crm/interactions/tasks` | Vista "Mi día" | Filtra por `due_at` y `assigned_to` (D3) |
| `POST /cron/commercial-digest` | Barrido diario: SLA, vigencias, recordatorios | Cron de cPanel, mismo patrón que `meta-capi` |

Todos los endpoints se documentan en el Swagger ya configurado en `api/docs`.

---

## 19. Matriz de permisos

`—` = sin acceso · `R` = lectura · `W` = lectura y escritura · `A` = administración

### 19.1 Acceso a espacios

Esta tabla se evalúa **antes** que cualquier permiso de módulo. Sin acceso al espacio, ningún permiso de módulo dentro de él tiene efecto.

| Rol | ◆ Comercial | ◆ Operación | ◆ Plataforma | Espacio por defecto |
|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | Plataforma |
| `commercial_director` | ✅ | ⚠️ solo lectura de Cuentas y Reportes | ❌ | Comercial |
| `operations_director` | ❌ | ✅ | ⚠️ solo lectura | Operación |
| Equipo de producción | ❌ | ⚠️ lectura de Cuentas y Reportes | ❌ | Operación |
| `client` | ❌ | ✅ limitado a su `clientId` | ❌ | Operación (sin selector) |

> El Director Comercial entra a Operación con acceso reducido y explícito: necesita ver si las cuentas que vendió están sanas, no operarlas. Al cambiar de espacio, su menú de Operación tiene tres entradas —Cuentas, Reportes, Inicio— y ninguna acción de escritura.

### 19.2 Permisos por módulo

| Módulo | Espacio | admin | commercial_director | operations_director | equipo producción | client |
|---|---|---|---|---|---|---|
| Inicio Comercial | ◆C | R | A | — | — | — |
| Pipeline / Oportunidades | ◆C | R | A | — | — | — |
| Empresas | ◆C | R | A | — | — | — |
| Contactos Comerciales | ◆C | R | A | — | — | — |
| Cotizaciones | ◆C | R | A | — | — | — |
| Actividades y Tareas | ◆C | R | A | — | — | — |
| Contratos | ◆C | A | A | — | — | — |
| Reportes Comerciales | ◆C | R | A | — | — | — |
| Ajustes Comerciales | ◆C | A | A | — | — | — |
| Inicio Operativo | ◆O | A | R | A | R | R |
| Reservas | ◆O | A | — | A | — | W |
| Calendario | ◆O | A | — | A | — | W |
| Agenda | ◆O | A | — | A | — | W |
| Páginas de Reserva | ◆O | A | — | A | — | W |
| Audiencia | ◆O | A | — | W | — | W |
| Cuentas — Directorio | ◆O | A | R | A | R | — |
| Cuentas — Ficha | ◆O | A | R | A | R | R (solo la propia) |
| Cuentas — Módulos | ◆O | A | — | R | — | — |
| Señales — Conexiones | ◆O | A | — | W | — | R (estado) |
| Señales — Calidad | ◆O | A | — | R | — | R |
| Señales — Cola de Envíos | ◆O | A | — | R | — | — |
| Reportes de Operación | ◆O | A | R | A | R | R (solo la propia) |
| Usuarios | ◆P | A | — | R | — | — |
| Roles y Permisos | ◆P | A | — | — | — | — |
| Módulos | ◆P | A | — | — | — | — |
| Auditoría | ◆P | A | — | R | — | — |
| Tareas Programadas | ◆P | A | — | R | — | — |
| Ajustes personales | — | W | W | W | W | W |

**Reglas de ámbito.**
1. Toda celda del rol `client` opera bajo el filtro obligatorio de su `clientId`.
2. Un permiso `W` o `A` en un módulo cuyo espacio el usuario no tiene habilitado (§19.1) **no se aplica**: el guard de espacio se evalúa primero y devuelve 403.
3. El Director Comercial tiene `R` en Cuentas y Reportes de Operación, y `—` en todo lo demás de ese espacio. Es acceso de consulta, no de operación.

---

## 20. Métricas de producto

### 20.1 Del producto (lo que mide si VitaHub funciona)

| Métrica | Definición | Objetivo Fase 1 |
|---|---|---|
| **Tasa de marcado de asistencia** | Reservas pasadas con resultado (`attended` o `no_show`) / reservas pasadas | > 85% |
| **Latencia de marcado** | Tiempo desde la hora de la reserva hasta que se marca | < 24h en el 90% |
| **Cobertura de identificadores** | % de reservas con email + teléfono + `fbc` | > 70% |
| **Tasa de entrega de eventos** | Eventos enviados con éxito / eventos encolados | > 98% |
| **Conversión de la página pública** | Reservas / visitas a `/r/{slug}` | > 12% |
| **Tasa de asistencia** | `attended` / (`attended` + `no_show`) | Se mide, es del restaurante |

### 20.2 De adopción

Cuentas activas · Páginas publicadas por cuenta · Usuarios activos semanales por cuenta · Días hasta la primera reserva real tras el alta.

### 20.3 Comerciales

Valor de pipeline · Valor ponderado · Tasa de cierre · Ciclo medio de venta · Motivos de pérdida · Días de onboarding hasta cuenta activa.

---

## 21. No-objetivos de Fase 1 y roadmap

### 21.1 Fuera de alcance en Fase 1 (declarado, no olvidado)

| No-objetivo | Por qué | Cuándo |
|---|---|---|
| Lectura de métricas de gasto de Meta (ROAS real) | Requiere `ads_read`, App Review y Business Verification | Fase 2 |
| Confirmación automática por WhatsApp/SMS | Requiere proveedor y costo por mensaje | Fase 3 |
| Gestión de mesas y plano del salón | Otro producto; VitaHub no es un sistema de sala | No planificado |
| Pagos y señas en línea | Requiere pasarela y flujo de reembolsos | Fase 3 |
| App móvil nativa | La web responsiva cubre el caso del anfitrión | No planificado |
| Perfil de comensal compartido entre cuentas | Compartiría datos personales entre clientes distintos | No planificado — decisión de privacidad, no de esfuerzo |
| Automatizaciones comerciales en tiempo real | La plataforma no admite workers persistentes | Barrido diario es lo correcto acá |

### 21.2 Roadmap

- **Fase 1 (este documento)** — circuito cerrado de conversión: reserva → evento → asistencia → evento. Los dos CRM separados y navegables.
- **Fase 2** — lectura de métricas de Meta y Google: gasto, ROAS sobre asistencia, costo por comensal sentado. Requiere App Review.
- **Fase 3** — comunicación con el comensal (recordatorios, confirmación), pagos, programa de recurrencia.

---

## 22. Anexos

### 22.1 Anexo A — Renombres de UI (checklist de implementación)

| Archivo/zona | Texto actual | Texto nuevo |
|---|---|---|
| Sidebar, sección `crm` | `CRM` | Desaparece — pasa a ser el **espacio ◆ Operación** |
| Sidebar, sección `pipeline` | `Pipeline` | Desaparece — pasa a ser el **espacio ◆ Comercial** |
| Sidebar, sección `admin` | `Administración` | Desaparece — pasa a ser el **espacio ◆ Plataforma** |
| Sidebar, item | `Contactos` (bajo CRM) | `Audiencia` (espacio Operación) |
| Sidebar, item | `Leads` | `Empresas` (espacio Comercial) |
| Sidebar, item | `Interacciones` | `Actividades` (espacio Comercial) |
| Sidebar, item | `Clientes` | `Cuentas` (espacio Operación) |
| Reservas | `Bandeja` | `Reservas` |
| Reservas | `Formularios` | `Páginas de Reserva` |
| Reservas | `Bloqueos` | `Cierres` |
| Reservas | `Disponibilidad` | `Agenda` |
| Integraciones | `Meta` | `Conexiones` |
| Integraciones | `Salud Conversiones` | `Calidad de Señal` |
| Integraciones | `Outbox` | `Cola de Envíos` |
| Constructor | `Campo protegido` | `Campo obligatorio del sistema` |
| Estados | `no_show` | `No asistió` |
| Estados | `cancelled_business` | `Cancelada por el local` |
| Estados | `cancelled_client` | `Cancelada por el comensal` |

### 22.2 Anexo B — Criterios de aceptación de Fase 1

Se conservan los siete criterios del brief original, reformulados sobre la estructura de este PRD:

| # | Criterio | Verificable en |
|---|---|---|
| 1 | La cuenta configura horario semanal y cierra días o franjas | §8.4 Agenda |
| 2 | Un día que alcanza el cupo se muestra "completo" al comensal | §15.1 + `GET /public/reservations/:slug/slots` |
| 3 | Una reserva de prueba dispara un evento con datos de emparejamiento en Meta | §9.2 Diagnóstico |
| 4 | Marcar "asistió" produce un segundo evento en Meta | §8.2 + §13.1 |
| 5 | Reserva y contacto quedan asociados a la cuenta correcta | §17.3 aislamiento |
| 6 | Un evento enviado al día siguiente (dentro de 7 días) se procesa | §9.3 Cola de Envíos |
| 7 | La calidad de coincidencia es visible | §9.2 Calidad de Señal |

**Criterios adicionales que introduce esta reorganización:**

| # | Criterio |
|---|---|
| 8 | Un usuario con rol `client` no puede acceder a ninguna ruta `/sales/**`, ni por menú ni por URL directa. Verificado con prueba de **backend**: el guard de espacio devuelve 403 |
| 9 | El rol `client` no ve el selector de espacio en ninguna resolución ni en ningún estado de la aplicación |
| 10 | El buscador global (`Ctrl/Cmd + K`) nunca devuelve resultados de otro espacio, ni siquiera parciales |
| 11 | Cambiar de espacio cambia menú, acento, título de pestaña y prefijo de URL, y aterriza en el Inicio del espacio destino |
| 12 | El último espacio usado se restaura al iniciar sesión desde cualquier dispositivo |
| 13 | Ganar una oportunidad crea exactamente una cuenta, en una transacción, con trazabilidad del origen |
| 14 | El paso de Comercial a Operación tras el handoff requiere una acción explícita del usuario; nunca es automático |
| 15 | Ningún contacto de Audiencia aparece en Contactos Comerciales, ni a la inversa |
| 16 | Ningún reporte combina datos de los dos espacios |
| 17 | Un cierre de agenda con reservas afectadas nunca se aplica sin avisar |
| 18 | Todo evento fallido es visible y reintentable desde la interfaz |

### 22.3 Anexo C — Decisiones de diseño registradas

| # | Decisión | Fundamento |
|---|---|---|
| ADR-1 | Dos CRM separados, con un único punto de contacto (el handoff) | Distintos sujetos, ciclos, métricas y audiencias. Mezclarlos hace inutilizables ambos embudos. |
| ADR-2 | `no_show` no envía evento a Meta | La CAPI no tiene conversión negativa; enviar algo le diría al algoritmo lo contrario de lo ocurrido. |
| ADR-3 | Sin perfil de comensal compartido entre cuentas | Compartir datos personales entre clientes distintos, aunque sea técnicamente trivial. |
| ADR-4 | Capabilities de terceros apagadas por defecto | Enviar PII a un tercero requiere un acto explícito y auditable. |
| ADR-5 | Automatizaciones por cron diario, no en tiempo real | iHosting/cPanel no admite workers persistentes. Para recordatorios comerciales, la granularidad diaria basta. |
| ADR-6 | Los módulos de agencia (producción, contenido, audiovisual) quedan fuera del menú por defecto | Pertenecen a la operación interna de La Vitamina, no al producto que se vende. |
| ADR-7 | "Asistió" es un botón directo, no una opción de menú | Es la acción que produce el valor diferencial del producto; cada clic adicional la degrada. |
| ADR-8 | **Dos CRM como espacios separados con selector explícito**, no como secciones de un mismo menú | Secciones de un mismo menú se leen como partes de un mismo embudo. Un selector que cambia menú, color, URL y alcance del buscador hace la separación evidente sin necesidad de explicarla. |
| ADR-9 | El cambio de espacio no preserva la pantalla equivalente | No hay equivalencias entre espacios. Fingirlas reintroduce la confusión que el diseño elimina. |
| ADR-10 | El buscador global es por espacio | Un resultado de Comercial apareciendo en una búsqueda de Operación es la fuga más fácil de producir y la más difícil de detectar. |
| ADR-11 | El rol `client` no ve el selector | Para el restaurante, VitaHub es un solo producto. Que existan otros espacios es información interna de La Vitamina. |
| ADR-12 | Prefijo de ruta por espacio (`/sales`, `/ops`, `/admin`) | Permite un guard de backend por prefijo: la separación deja de depender de que el menú esté bien armado. |

---

## 23. Anexo D — Verificación contra el código

Auditoría hecha leyendo el repositorio, no infiriendo. Cada hallazgo cita archivo y línea.

### D-1 🔴 CRÍTICO — Una reserva crea un lead comercial, y puede crear una oportunidad

**Este es el bug que corresponde exactamente a la mezcla de dominios que el PRD describe. No es teórico: está en producción.**

Cadena real, verificable:

```
POST /public/reservations/{slug}
  └─ reservations.service.ts:486  →  leadIntake.captureLead({ ... status:'reserved' })
        └─ lead-intake.service.ts:122  →  guarda una fila en «crm_leads»
              ← la MISMA tabla donde viven las Empresas prospecto del CRM Comercial
        └─ lead-intake.service.ts:123  →  automation.runForLead(savedLead)
              └─ crm-lead-automation.service.ts:22  → crea Interaction «lead_ingested»
              └─ si fitStatus === QUALIFIED (línea 29):
                   ├─ :36 ensureContact()      → crea el Contact (Audiencia)
                   ├─ :37 ensureOpportunity()  → CREA UNA OPORTUNIDAD COMERCIAL
                   │        stage 'qualified', probabilidad 35,
                   │        asignada al Director Comercial,
                   │        cierre estimado a 14 días
                   └─ :38 ensureQualifiedInteraction()
```

**¿Se dispara de verdad?** Sí. El scoring de `qualifyLead()` (`lead-intake.service.ts:205`) fue diseñado para prospectos comerciales y, aplicado a un comensal, suma sin dificultad:

| Señal | Puntos | ¿La cumple un comensal? |
|---|---|---|
| `email` | +20 | Sí, si el formulario lo pide |
| `phone` | +25 | Sí, es campo obligatorio |
| `work_email` (dominio no genérico) | +10 | Sí, si reserva con su correo de trabajo |
| `campaign_context` | +5 | Sí, toda reserva desde campaña |
| `HIGH_INTENT_KEYWORDS` × 6 c/u | +12 | **Sí, garantizado**: la lista incluye `'reserva'` y `'restaurante'` (líneas 31–32), y el `haystack` contiene `sourceDetail` = **el nombre del formulario** y `campaignName` |

**Total: 72 puntos ≥ 70 → `QUALIFIED` → se crea la oportunidad.**

Basta con que el formulario se llame "Reservas Restaurante Del Puerto" para que cada comensal con correo corporativo genere una oportunidad comercial falsa en el pipeline, asignada al Director Comercial, con fecha de cierre a 14 días.

**Consecuencias medibles:**
- El forecast comercial cuenta comensales como oportunidades.
- El Director Comercial recibe asignaciones automáticas de gente que solo quería una mesa.
- La tasa de cierre se hunde con oportunidades que nunca fueron ventas.
- Datos personales de comensales quedan expuestos en el espacio Comercial, que según §19.1 no debería verlos jamás.

**Corrección requerida** (además de D6 y D7 de §17.4):

| # | Acción | Archivo |
|---|---|---|
| C1 | `captureLead()` acepta un `domain`. Con `domain='audience'` **no invoca `automation.runForLead()`** en absoluto | `lead-intake.service.ts:123` |
| C2 | Alternativa preferible a medio plazo: que el flujo de reserva **no toque `crm_leads`** y escriba directo en `crm_contacts` con su `client_id` (D6). El scoring comercial no aplica a un comensal y no debería ejecutarse | `reservations.service.ts:486` |
| C3 | Mientras C2 no exista, `ensureOpportunity()` debe rechazar leads cuyo `source` sea `'vitahub_reservations'` | `crm-lead-automation.service.ts:58` |
| C4 | Los listados de `/sales/**` filtran por `domain='commercial'`; los de `/ops/audience` por `domain='audience'` | controladores de `crm` |

**Prueba de regresión obligatoria:** crear una reserva con correo de dominio propio y verificar que **no** aparece ninguna fila nueva en `crm_opportunities`.

#### Estado: C1, C3 y D-3 corregidos el 2026-07-28

| Cambio | Archivo |
|---|---|
| `LeadCaptureInput.domain` (`'commercial' \| 'audience'`, por defecto `commercial`); se extrae antes de armar la entidad para no persistirlo como columna | `lead-intake.service.ts` |
| El scoring comercial no se aplica a `audience`: puntaje 0, `REVIEW`, sin motivo de descarte | `lead-intake.service.ts` |
| `audience` ejecuta solo `ensureAudienceContact()`; nunca la automatización comercial | `lead-intake.service.ts` |
| `ensureAudienceContact()` público, crea el contacto **siempre**, sin depender del scoring (corrige D-3) | `crm-lead-automation.service.ts` |
| `runForLead()` desvía por origen aunque no se declare el dominio (segunda barrera) | `crm-lead-automation.service.ts` |
| `ensureOpportunity()` rechaza leads de origen `vitahub_reservations` (tercera barrera) | `crm-lead-automation.service.ts` |
| El flujo de reserva declara `domain: 'audience'` | `reservations.service.ts` |
| 5 pruebas de regresión nuevas | `test/unit/crm/lead-intake.service.spec.ts` |
| Consultas de auditoría de datos ya contaminados, solo lectura | `scripts/local/audit-audience-leaks.sql` |

Verificado: **314/314 pruebas pasan**, `tsc` limpio en la API.

**Pendiente de este bloque:** C2 (que las reservas dejen de escribir en `crm_leads`), D6 (`client_id` en `crm_contacts`) y D7 (columna `domain`). Requieren migración y quedan para la siguiente iteración.

---

### D-2 🔴 `crm_contacts` no tiene `client_id`

`contact.entity.ts` tiene `organization_id` y `lead_id`, y ningún vínculo con la cuenta. Los comensales de todos los restaurantes de La Vitamina están en una sola tabla sin separar.

- Contradice §8.6 ("un contacto pertenece a **una** cuenta"), §17.3 y la regla de privacidad ADR-3.
- El filtro `?clientId=` que el PRD asume en `GET /crm/contacts` **no puede funcionar**: no hay columna que filtrar.
- Corrección: D6 de §17.4. El relleno se puede derivar de `lead_id → crm_leads.client_id`.

---

### D-3 🟡 La Audiencia se puebla solo con leads calificados

`crm-lead-automation.service.ts:29` corta la ejecución si `fitStatus !== QUALIFIED`. El `ensureContact()` está **después** de ese corte.

Efecto real: un comensal que reserva con Gmail y sin campaña suma ~50 puntos → `REVIEW` → **nunca llega a Audiencia**. El módulo muestra una fracción arbitraria de los comensales reales, sesgada hacia quienes usan correo corporativo.

Corrección: la creación del contacto de Audiencia no debe depender de ningún scoring comercial. Todo comensal que reserva es un contacto de Audiencia, por definición.

---

### D-4 🟡 Dos topes diarios, y el PRD documentaba uno solo

Existen dos límites de capacidad, y ambos se aplican:

| Campo | Entidad | Alcance |
|---|---|---|
| `dailyCapacity` | `ReservationForm` | Tope por página de reserva |
| `dailyReservationCap` | `Client` (`client.entity.ts`) | Tope del restaurante completo, sumando todas sus páginas. `0` = sin límite |

El comentario del código es explícito: *"el tope por formulario sigue existiendo y se aplica además de este"*. **§8.4 de este PRD queda corregido**: la pantalla de Agenda debe mostrar ambos, indicar cuál está limitando y advertir cuando el tope de cuenta hace irrelevante el de la página.

---

### D-5 🟡 El espacio del cliente ya existe, con otro menú

`/portal` está construido: `ClientLayout.tsx`, `ClientRoute.tsx`, rutas en `router.tsx:114`. `HomeRedirect` ya manda al rol `client` a `/portal` y al resto a `/dashboard` — **el patrón de dos espacios ya existe a medias en el código.**

Pero el menú actual no coincide con el que especifica §6.3:

| Menú actual de `/portal` | ¿Está en el PRD? |
|---|---|
| Inicio | ✅ |
| Reservas | ✅ |
| **Grilla** | ❌ — entregable de agencia (contenido) |
| **Aprobaciones** | ❌ — entregable de agencia |
| **Reuniones** | ❌ — entregable de agencia |
| Informes | ✅ (como "Reportes") |
| — falta **Calendario** | ⚠️ |
| — falta **Agenda** como entrada de menú | ⚠️ menor: **sí es alcanzable** desde Reservas → tarjeta del formulario → botón "Configurar agenda" (`ReservationsPage.tsx:263`, `formPath()` apunta a `/portal/reservations/forms/:id`). El criterio de aceptación 1 de Fase 1 se cumple; falta el acceso directo |
| — falta **Páginas de Reserva** como entrada de menú | ⚠️ misma ruta, mismo acceso indirecto |
| — falta **Audiencia** | ⚠️ |

**Decisión tomada (2026-07-28): el portal se limita al producto VitaHub.**

Menú definitivo de `/portal`: Inicio · Reservas · Calendario · Agenda · Páginas de Reserva · Audiencia · Reportes.

Grilla, Aprobaciones y Reuniones **no desaparecen**: pasan a estar gobernadas por capability y se muestran solo a los clientes que además contratan servicios de agencia. Fundamento: VitaHub debe poder venderse a un restaurante que no compra producción de contenido, y ese cliente no puede encontrarse con tres secciones vacías de un servicio que no contrató.

Trabajo derivado: agregar las entradas de Agenda, Páginas de Reserva (la ruta `/portal/reservations/forms/:id` **ya existe sin entrada de menú**), Calendario y Audiencia; y condicionar las tres de agencia a capability.

---

### D-6 🟡 Etiquetas actuales vs. las del PRD

Varias ya son razonables; la tabla de renombres del Anexo A queda corregida con los valores reales:

| Ruta | Etiqueta real hoy | Etiqueta PRD |
|---|---|---|
| `/crm/contacts` | "Contactos de campañas" | **Audiencia** |
| `/crm/leads` | "Prospectos" | **Empresas** |
| `/crm/opportunities` | "Pipeline de oportunidades" | **Pipeline** / **Oportunidades** (dos vistas) |
| `/crm/interactions` | "Actividad comercial" | **Actividades** + **Tareas** |
| `/reservations` | "Reservas y formularios" | **Reservas** (las páginas se separan) |
| `/clients` | "Clientes" | **Cuentas** |
| `/settings` | "Configuracion" | **Ajustes** — *y corregir la tilde faltante* |

---

### D-7 🟢 Los emojis de los manifiestos **no se renderizan** — corrección

Afirmación anterior corregida. Los `feature.manifest.ts` declaran emoji en `icon`, pero **el sidebar no los usa**: `Layout.tsx:86` renderiza `<NavGlyph label={item.label} />`, que dibuja un glifo de dos letras (`DB`, `RS`, `CL`). El campo `icon` de los manifiestos es hoy dato muerto.

Consecuencia: no hay emojis visibles en la navegación y la migración a Font Awesome **no es un pendiente de Fase 1**. Queda como limpieza: o se borra el campo `icon`, o se conecta a `VitaIcons`.

---

### D-10 🟡 Código muerto que puede confundir a quien retome el trabajo

Cuatro artefactos construidos y nunca conectados. No afectan lo que se ve, pero simulan trabajo hecho:

| Artefacto | Estado |
|---|---|
| `core/Sidebar.tsx` + `Sidebar.css` | Sidebar alternativo con `VitaIcons` y menú propio. **Nadie lo importa**; el sidebar real es `shared/Layout.tsx`. Además apunta a `/crm`, ruta que no existe |
| `features/forms/FormBuilderDnD.tsx` | El constructor con dnd-kit. **`ReservationBuilderPage` no lo usa**: el reordenamiento real es HTML5 nativo |
| `shared/ProgressTicket.tsx` | Sin referencias |
| `shared/FieldLabel.tsx` | Sin referencias: la nomenclatura "Requerido / candado" no está aplicada |

**Sobre el bug de arrastre:** `UX_REDESIGN_STRATEGY.md` lo daba por crítico. Verificado en `ReservationBuilderPage.tsx:264`, la función `reorder()` es correcta —descarta `from === to` y reordena con `splice`— y además hay botones ↑/↓ como alternativa accesible. **El bug no existe.** `FormBuilderDnD` resolvía un problema ya resuelto.

---

### D-11 🔴 Enlaces muertos al restringir el alcance — corregido

Al ocultar los módulos fuera de fase, todo enlace fijo hacia ellos pasa a terminar en 404. Encontrados y corregidos:

| Ubicación | Enlaces rotos | Corrección |
|---|---|---|
| `ClientDetailPage.tsx` | 3 tarjetas de KPI y 2 paneles hacia `/production`, `/meetings`, `/documents`; y 7 de los 8 accesos rápidos, que solo se filtraban por rol | Las tarjetas y paneles se condicionan al alcance; los accesos rápidos pasan por `isPathEnabled` |
| `CommandPalette.tsx` | `hasPath('/crm')` daba verdadero por `/crm/contacts` y ofrecía 5 entradas al CRM comercial oculto; además consultaba `/crm/leads`, `/crm/opportunities` y `/documents` y listaba resultados con enlaces muertos | `canOpen(ruta exacta)` sobre `isPathEnabled`, aplicado a entradas y a consultas |
| `DashboardPage.tsx` | Enlace a `/production` en la franja de atención | Ya cubierto: el widget depende del módulo `production` y no se muestra |

**Regla que deja el caso cerrado:** todo enlace fijo hacia otro módulo se valida con `isPathEnabled`, la misma función que arma el menú. Un destino que el usuario no puede abrir no se ofrece.

---

### D-8 🟢 Confirmaciones — el PRD acertó

| Afirmación del PRD | Verificado en |
|---|---|
| Transiciones de estado de reserva | `reservations.service.ts:54-60` — coincide exactamente con §13.1 |
| `no_show` no envía evento a Meta | `reservations.service.ts:723-727`, con el fundamento comentado |
| Capabilities con terceros apagadas por defecto | `client-capabilities.ts` — `metaConversions:false`, `googleConversions:false` |
| Sincronización de asistencia al CRM es *best-effort* y no revierte la reserva | `reservations.service.ts:731` |
| `clients.lead_id` ya vincula cuenta con empresa | `client.entity.ts` |
| El guard de espacio hay que construirlo | `FeatureManifest` no tiene campo `workspace` (§6.6-N2) |

---

### D-9 Orden de corrección recomendado

| Prioridad | Ítem | Por qué primero |
|---|---|---|
| 1 | **C1/C3** — cortar la creación de oportunidades desde reservas | Está contaminando el pipeline hoy, con cada reserva |
| 2 | **D6** — `client_id` en `crm_contacts` | Aislamiento entre cuentas; es un asunto de datos personales |
| 3 | **D-3** — contacto de Audiencia sin depender del scoring | El módulo Audiencia hoy miente por omisión |
| 4 | **D7 (§17.4)** — discriminador `domain` | Habilita separar las vistas de los dos espacios |
| 5 | **C2** — sacar el flujo de reserva de `crm_leads` | Corrección de fondo, una vez estabilizado lo anterior |
| 6 | Guard de espacio por prefijo (§6.6-N3) | Hace exigible la separación |
| 7 | Renombres y iconos | Cosmético comparado con lo anterior |

---

**Fin del documento.**
Cualquier cambio de alcance debe reflejarse acá antes de implementarse.
