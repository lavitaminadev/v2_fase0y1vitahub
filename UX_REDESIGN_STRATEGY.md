# VitaHub — UX/UI Redesign Strategy

**Propósito:** Plan de mejora de experiencia usuario (3 sprints, máxima eficiencia)

---

## 1. ANÁLISIS DE MEJORAS (Agrupadas por área)

### A. IDENTIDAD VISUAL & LOGO

**Problema actual:**
- Logo de empresa no visible en sidebar
- Sin carpetas organizadas por empresa en Cloudinary
- Permisos: equipo ve todo, no se puede restringir por empresa

**Solución óptima:**
```
Manager (de empresa) 
  ↓ sube logo
  ↓ almacena en Cloudinary (carpeta /empresa/{clientId})
  ↓ aparece en sidebar + header
  ↓ equipoVitahub ve TODAS (global admin)
  ↓ if estoy dentro empresa X → equipo solo ve carpeta X
```

**Implementación:**
1. Agregar `logoUrl` a Client entity (ya existe)
2. Crear estructura Cloudinary: `/vitahub/clients/{clientId}/`
3. Endpoint `PUT /clients/{id}/logo` (manager only)
4. Guard: `if (equipo) ver todo; else if (manager) ver su empresa`
5. Actualizar sidebar component

**Estimación:** 2h (código + Cloudinary setup)

---

### B. ICONOGRAFÍA & UNIFICACIÓN (Font Awesome)

**Problema actual:**
- Mix de icons: emoji, custom SVG, text
- Inconsistencia visual
- No escalable

**Solución:**
- **Remover:** todos los emojis
- **Usar:** `react-icons` con Font Awesome (ya es dep estándar)
- **Centralizar:** `src/shared/Icons.tsx` con wrapper
- **Aplicar:** en buttons, badges, status, navigation

**Implementación:**
```typescript
// src/shared/Icons.tsx
import { FaCheckCircle, FaTimesCircle, FaPencil, FaTrash, FaCog, FaHome } from 'react-icons/fa';

export const Icons = {
  success: FaCheckCircle,
  error: FaTimesCircle,
  edit: FaPencil,
  delete: FaTrash,
  settings: FaCog,
  home: FaHome,
  // ... más
};

export function IconButton({ icon: Icon, label, ...props }) {
  return <button {...props}><Icon /> {label}</button>;
}
```

**Alcance:**
- Settings page (users, security)
- Buttons en ReservationsPage
- Badges de status
- Navigation icons

**Estimación:** 4h (cleanup + aplicación)

---

### C. MENÚ & NAVEGACIÓN

**Problema actual:**
- Submenus inline (toman espacio)
- No colapsable
- No responsive para mobile

**Solución óptima:**

```
Desktop (normal):
  [Logo] [Menu de opción]  submenu inline
         Ej: Reservas → [Formularios] [Bandeja] [Métricas]

Mobile (<768px):
  [Logo] [≡ Hamburger]
  
  Al click ≡:
  [x] MENÚ
  ├─ Dashboard
  ├─ Reservas
  │  ├─ Formularios
  │  ├─ Bandeja
  │  └─ Métricas
  ├─ CRM
  └─ Configuración
```

**Cambio arquitectura:**
- En desktop: mostrar submenu al hover (no inline fijo)
- En mobile: drawer/slide (posición fixed left)
- Colapsable: icono "<<" / ">>" para contraer/expandir

**Implementación:**
```tsx
// src/core/Navigation.tsx
export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? '<<' : '>>'}
      </button>
      {/* Navigation items */}
    </aside>
  );
}

// CSS
.sidebar { width: 280px; transition: width 0.3s; }
.sidebar.collapsed { width: 60px; }
.sidebar.collapsed .label { display: none; }

@media (max-width: 768px) {
  .sidebar { position: fixed; left: 0; top: 0; height: 100vh; z-index: 1000; }
}
```

**Estimación:** 6h (refactor + responsive + animations)

---

### D. AUTH & SETTINGS (Simplificación)

**Problema actual:**
- Change password en modal separado
- Settings esparcidos
- UI larga/tedioso

**Solución:**
Página única `/settings` con 3 secciones (tabs):

```
┌─ PROFILE ──────────────────────┐
│ [Logo usuario]                 │
│ Nombre: [text input]           │
│ Email: [text input]            │
│ [Guardar cambios]              │
├─ SECURITY ─────────────────────┤
│ Contraseña actual: [password]  │
│ Nueva contraseña: [password]   │
│ Repetir: [password]            │
│ [✓ Cambiar] [✗ Cancelar]       │
│                                │
│ 🔒 2FA (if enabled)            │
│ [Habilitar/Deshabilitar]       │
├─ EMPRESA (if manager) ─────────┤
│ Nombre: [text]                 │
│ Logo: [upload] [preview]       │
│ [Guardar]                      │
└────────────────────────────────┘
```

**Cambio UX:**
- Validación inline (no modal)
- Confirmación de éxito (toast notification)
- Loading state visual
- Error messages claros

**Estimación:** 3h (refactor auth forms + unificar en Settings)

---

### E. FORMULARIOS (Builder - Drag & Drop Bug Fix)

**Problema actual:**
- Drag & drop se buguea si mueves dentro del mismo contenedor
- Formulario muy largo (scroll infinito)
- Controles redundantes

**Bug específico:**
```
// Problema: draggable items dentro de mismo container
<div droppable>
  <Item draggable /> ← puede caer en sí mismo
  <Item draggable />
</div>

// Solución: usar librería correcta (dnd-kit, react-beautiful-dnd)
```

**Solución completa:**

**1. Usar `dnd-kit` (mejor que actual)**
```bash
npm install @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/core
```

**2. Simplificar UI con Accordion**
```
┌─ INFORMACIÓN BÁSICA ───────────┐ [▼ expandido]
│ Nombre: "Contacto"             │
│ Descripción: [text]            │
│ [Guardar]                      │
├─ CAMPOS (Drag here) ───────────┤ [▼ expandido]
│ ┌──────────────────────────────┐│
│ │ ⋮ Nombre [text] [Requerido] ││ ← draggable
│ │ [Editar] [Eliminar]          ││
│ └──────────────────────────────┘│
│ + Agregar campo                 │
├─ DISPONIBILIDAD ────────────────┤ [▼ colapsado]
│ [Expandir para ver horarios]    │
├─ DISEÑO ────────────────────────┤ [▼ colapsado]
├─ META INTEGRATION ──────────────┤ [▼ colapsado]
└─────────────────────────────────┘
```

**3. Fix drag & drop**
- Usar `dnd-kit` (librería robusta)
- Validación: no permitir drop en sí mismo
- Preview visual al arrastrar

**Estimación:** 8h (migraración dnd + simplificar accordion + tests)

---

### F. FORMULARIOS (Nomenclatura & UX)

**Problema actual:**
- "Campo protegido" → confuso
- Nombre/email no visiblemente "requeridos"
- No editable el label

**Solución:**

| Anterior | Nuevo | Icono |
|----------|-------|-------|
| "Campo protegido" | "Requerido" | 🔴 (rojo) |
| "Email" | "Email" | 🔒 (candado = fundamental) |
| "Nombre" | "Nombre" | 🔒 |

**Implementación:**
```tsx
<Field
  label="Nombre"
  required={true}
  icon={LockIcon} // Candado
  editable={true} // Allow rename
  placeholder="Ej. Nombre completo"
/>
```

**Estimación:** 2h (actualizar Field component + labels)

---

### G. RESERVAS (Simplificación de UI)

**Problema actual:**
- Demasiados botones por reserva
- Estados no visuales (texto)
- Difícil ver de un vistazo

**Solución: Traffic Light (Semáforo)**

```
┌─────────────────────────────────────┐
│ #REF-001 | Juan Pérez | 15 Ago 14:00│
│ [🟢] Confirmada                     │ ← Click = cambiar estado
│ [Edit] [Details] [...menu]          │
└─────────────────────────────────────┘

Estados:
🟢 = Confirmada / Asistida (success)
🟡 = Pendiente / Borrador (warning)
🔴 = Cancelada / No show (error)
⚪ = Lista de espera (neutral)
```

**Cambio HTML:**
- Botón único de status (semáforo)
- Click abre dropdown: [Confirmar] [Pendiente] [Cancelar] [No show]
- Otros botones en menu "..." (3 dots)

**Estimación:** 3h (refactor ReservationsPage + semáforo component)

---

### H. EXPORTAR (Módulo aparte - MVP)

**Problema actual:**
- No existe exportación
- Si existe, funcionalidad limitada

**Solución: Módulo "Export" independiente**

```
┌─ EXPORTAR RESERVAS ────────────────┐
│ Rango: [Desde] [Hasta]             │
│ Formato: [CSV ▼]                   │
│   ├─ CSV
│   ├─ JSON
│   └─ PDF
│                                    │
│ Campos:                            │
│ ☑ Nombre                           │
│ ☑ Teléfono                         │
│ ☑ Email                            │
│ ☑ Fecha                            │
│ ☑ Estado                           │
│ ☑ Asistencia                       │
│ ☐ Notas internas                   │
│                                    │
│ [Descargar] [Cancelar]             │
└────────────────────────────────────┘
```

**Implementación:**
1. Componente `ExportModal.tsx` (dialog)
2. Endpoint backend: `POST /reservations/export`
3. Generar CSV/JSON en backend (zip si PDF)
4. Trigger: botón en ReservationsPage

**Estimación:** 4h (modal + backend export logic)

---

### I. ESTADO & NOTIFICACIONES

**Problema actual:**
- No hay feedback de éxito/error en operaciones
- No hay loading states visuales
- Notificaciones inconsistentes

**Solución:**

1. **Toast notifications** (ya existe)
   ```tsx
   triggerToast('Reserva confirmada', 'success');
   triggerToast('Error al guardar', 'error');
   ```

2. **Loading states en botones**
   ```tsx
   <button disabled={isSaving}>
     {isSaving ? '⏳ Guardando...' : 'Guardar'}
   </button>
   ```

3. **Ticket/Progress** (para formularios)
   ```
   [✓] Información básica
   [✓] Campos
   [→] Disponibilidad
   [ ] Diseño
   [ ] Revisión final
   ```

**Estimación:** 2h (actualizar componentes + progress indicator)

---

### J. CLOUDINARY (Organización por empresa)

**Problema actual:**
- Todos los archivos en raíz
- Sin control de permisos

**Estructura óptima:**
```
vitahub/
├── clients/
│   ├── {clientId-1}/
│   │   ├── logos/
│   │   └── designs/
│   ├── {clientId-2}/
│   └── ...
└── team/
    └── shared/
```

**Permisos:**
```
Manager ({clientId=X})
  → Upload a /clients/X/*
  → Ver solo /clients/X/*

Team (equipo Vitamina)
  → Ver /clients/* (TODAS)
  → Upload a /team/shared/*
  
Admin
  → Todo
```

**Implementación:**
```typescript
// cloudinary.service.ts
async uploadLogo(clientId: string, file: File, userId: string) {
  const folder = this.getFolder(userId, clientId);
  // folder = "vitahub/clients/{clientId}" OR "vitahub/team/shared"
  return this.cloudinary.upload(file, { folder });
}
```

**Estimación:** 3h (refactor Cloudinary service + permisos)

---

## 2. PRIORIZACIÓN (3 Sprints)

### 🟢 SPRINT 1 (Urgente - Semana 1)
Impacto máximo, poco riesgo

| Item | Horas | Razón |
|------|-------|-------|
| B. Font Awesome icons | 4h | Visual consistency (UI mejora inmediata) |
| G. Simplificar botones reservas (semáforo) | 3h | UX clara, reduce clics |
| D. Change password → Settings page | 3h | Flujo unificado |
| **Total** | **10h** | Impacto visual + UX inmediata |

### 🟡 SPRINT 2 (Importante - Semana 2)
Arquitectura + funcionalidad

| Item | Horas | Razón |
|------|-------|-------|
| E. Fix drag & drop + simplificar form builder | 8h | Elimina bug crítico |
| C. Menú responsive + colapsable | 6h | Navigation core |
| H. Módulo exportar (CSV/JSON/PDF) | 4h | Feature nueva valiosa |
| **Total** | **18h** | Funcionalidad + UX avanzada |

### 🔵 SPRINT 3 (Nice-to-have - Semana 3)
Polish + identidad

| Item | Horas | Razón |
|------|-------|-------|
| A. Logo upload + Cloudinary org | 2h | Identidad visual |
| F. Nomenclatura (Requerido vs Protegido) | 2h | Claridad |
| I. Notificaciones + progress tickets | 2h | Feedback UX |
| J. Cloudinary permisos por empresa | 3h | Seguridad |
| **Total** | **9h** | Polish + seguridad |

---

## 3. PROPUESTA DE ENFOQUE TÉCNICO

### Stack
- **UI:** React + Tailwind (unificado)
- **Icons:** `react-icons` (Font Awesome)
- **Drag & Drop:** `dnd-kit` (mejor que actual)
- **Form validation:** ya existe
- **Notifications:** Toast (reutilizar)
- **Export:** backend (papaparse para CSV)

### Estructura de commits
```
Sprint 1:
  - feat: replace emoji icons with Font Awesome
  - style: unify button styling (caps, spacing)
  - feat: add traffic light status for reservations
  - refactor: consolidate auth to settings page

Sprint 2:
  - fix: replace drag-drop with dnd-kit (eliminate bug)
  - style: accordion form builder (simplify UI)
  - feat: responsive collapsible sidebar navigation
  - feat: add export reservations module

Sprint 3:
  - feat: add logo upload for clients
  - refactor: rename "protected field" → "required"
  - feat: add progress tickets for form builder
  - feat: implement Cloudinary org by client
```

---

## 4. RIESGOS & MITIGACIÓN

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Drag & drop migration breaks existing forms | Alto | Migrate en ENV dev primero, tests unitarios |
| Sidebar responsiveness en mobile | Medio | Probar en device real (Inspect tool) |
| Icon replacement (emoji → FA) inconsistency | Bajo | Script para buscar/reemplazar, visual audit |
| Export backend performance (grandes datasets) | Medio | Paginar export, limit 10k rows |

---

## 5. MÉTRICAS DE ÉXITO

- ✅ Cero bugs en drag & drop
- ✅ Menu responsive (testeado mobile + desktop)
- ✅ Export funciona con 3 formatos
- ✅ Settings page unificada
- ✅ Logo visible en sidebar
- ✅ Visual consistency (Font Awesome en 100% de app)

---

## SIGUIENTE: ¿EMPEZAMOS?

**¿Confirmación antes de implementar?**

- ✅ Prioridad: Sprint 1 → 2 → 3 (semanal)
- ✅ Enfoque: Caveman 21st (solo cambios necesarios)
- ✅ Testing: Local + checklist visual
- ⏳ **¿Vamos?**

---

**Estimación total:** 37h (3 sprints de ~12h c/u)  
**Timeline:** 3 semanas (caveman: sin exploración)  
**Tokens:** Máximo ahorro (commits pequeños, tests on-the-fly)
