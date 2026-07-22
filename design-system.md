# VITAHUB — Sistema de diseño del prototipo

Este documento describe el sistema visual y los patrones de interfaz usados en los prototipos HTML de VITAHUB.

## Archivos del prototipo

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Landing page de VITAHUB: hero, features, módulos, dashboard mock, testimonial y CTA. |
| `dashboard.html` | Dashboard operativo: KPIs, gráfico de barras, progreso por cliente, acciones rápidas y actividad. |
| `produccion.html` | Kanban de producción: columnas Asignada → En proceso → En revisión → Entregada. |
| `crm.html` | Pantalla de CRM: pipeline de leads, filtros, búsqueda, tabla de oportunidades y stats. |
| `conexiones.html` | Hub de integraciones: Meta, Google, Drive, Slack, Webhook con toggles y log de actividad. |
| `design-system.md` | Este documento. |
| `critique.json` | Panel de crítica con puntuación por ejes. |

## Dirección visual

**Modern minimal / SaaS.** Fondos neutros casi blancos, tipografía system-ui, un solo acento azul producto y estados semánticos en verde, naranja y rojo.

## Tokens de color

```css
:root {
  --bg:      oklch(99% 0.002 240);   /* fondo de página */
  --surface: oklch(100% 0 0);        /* tarjetas y paneles */
  --fg:      oklch(18% 0.012 250);   /* texto principal */
  --muted:   oklch(54% 0.012 250);   /* texto secundario */
  --border:  oklch(92% 0.005 250);   /* bordes y divisores */
  --accent:  oklch(58% 0.18 255);    /* acento principal */

  /* Derivados */
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --fg-soft:     color-mix(in oklch, var(--fg) 5%, transparent);
  --accent-dark: color-mix(in oklch, var(--accent) 85%, black);

  /* Semánticos */
  --success: oklch(62% 0.16 145);
  --warning: oklch(70% 0.18 85);
  --danger:  oklch(58% 0.20 25);
}
```

**Reglas de uso:**
- El acento `--accent` aparece como máximo dos veces por pantalla: eyebrow + CTA principal, o badge + acción principal.
- Los colores semánticos solo se usan para estados (badges, toggles, deltas).
- No se usa hex fuera del bloque `:root`.

## Tipografía

- **Display:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif` — usada en `h1`, `h2` y logo.
- **Body:** `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif` — cuerpo de texto y botones.
- **Mono:** `ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace` — números, fechas, labels y eyebrow.

## Componentes principales

### Botones

| Clase | Uso |
|-------|-----|
| `.btn-primary` | Acción principal (CTA, guardar, nuevo lead). |
| `.btn-secondary` | Acción secundaria o cancelar. |
| `.btn-ghost` | Enlaces dentro de tablas o barras de herramientas. |
| `.btn-sm` | Variante compacta para tablas y toolbars. |

**Estados:** hover, active (translateY 1px), focus-visible (anillo `--accent-soft`), loading (spinner absoluto + texto transparente).

### Navegación

- **Landing:** `topnav` sticky con fondo translúcido y backdrop blur. Menú hamburguesa en móvil.
- **App (CRM/Conexiones):** `sidebar` fija en escritorio y `mobile-nav` fija en la parte inferior en móvil.
- **Active state:** `.nav-item.active` con fondo `--accent-soft` y color `--accent`; incluye `aria-current="page"`.

### Tablas

- `.crud-table` con hover por fila, acciones de fila que aparecen en hover/focus y siempre visibles en móvil.
- Números y cantidades usan `font-variant-numeric: tabular-nums`.

### Filtros

- `.filter-chip` para filtros de estado tipo píldora.
- En CRM, el botón "Filtros" colapsa/expande el contenedor de chips.

### Badges de estado

| Estado | Clase | Color |
|--------|-------|-------|
| Nuevo | `.status.nuevo` | Neutro |
| Contactado | `.status.contactado` | Acento |
| Negociación | `.status.negociacion` | Advertencia |
| Ganado | `.status.ganado` | Éxito |
| Perdido | `.status.perdido` | Peligro |

## Responsive

- Breakpoint principal: `920px` (colapso de grids y sidebar).
- Tablas: scroll horizontal automático en contenedor.
- Navegación móvil: barra inferior fija para CRM y Conexiones; menú hamburguesa para Landing.

## Accesibilidad

- Todos los botones e inputs tienen `focus-visible` visible.
- Enlaces activos marcan `aria-current="page"`.
- Menú hamburguesa controla `aria-expanded`.
- Toggles son `<input type="checkbox">` estilizado y accesible por teclado.

## Convenciones de nomenclatura

- `data-od-id` en cada `<section>` o región principal para inspección.
- Prefijos de clases: `.btn-*`, `.card-*`, `.nav-*`, `.crud-*`.

## Componentes adicionales

### Kanban de producción

- `.board` contiene 4 `.column` (Asignada, En proceso, En revisión, Entregada).
- Cada tarjeta `.card` incluye: ID, título, cliente, UD, tags y avatar-stack.
- Filtros por estado, urgencia y cliente.

### Dashboard

- `.stats` de 4 columnas con KPIs y deltas.
- `.chart` con barras `.chart-bar` para visualización semanal.
- `.progress-list` con barras de progreso por cliente.
- `.quick-actions` para accesos directos.
- `.activity` feed de eventos con puntos de color semántico.

## Cómo añadir una nueva pantalla

1. Copia la estructura base de `crm.html` o `conexiones.html`.
2. Reutiliza las variables `:root` (mantén el mismo sistema visual).
3. Añade el enlace en `sidebar` y `mobile-nav` de todas las pantallas.
4. Asigna `data-od-id` descriptivo a cada sección principal.
