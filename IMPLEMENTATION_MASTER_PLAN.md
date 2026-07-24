# VitaHub — Implementación Exhaustiva Completa

**Estado:** 🔄 EN PROGRESO (3 agentes paralelos)  
**Paleta Corporativa:** Cian (#0EC6B8) + Rosa (#EA0F63)  
**Fecha inicio:** 2026-07-24  
**Estimación:** 37 horas (3 sprints × 12h)

---

## 📋 RESUMEN EJECUTIVO

Implementación EXHAUSTIVA de redesign UX/UI:
- **3 agentes en paralelo** (Sprint 1, 2, 3 simultáneamente)
- **Paleta corporativa** aplicada en TODOS lados
- **0 emojis** → Font Awesome icons
- **Menú responsive** colapsable
- **Drag & drop fixed** (bug crítico)
- **Logo upload** con Cloudinary org
- **Export module** (CSV/JSON/PDF)
- **Semáforo status** para reservas
- **Settings unificado** (auth + profile + empresa)
- **Notificaciones center** + progress tickets
- **Nomenclatura clara** (Requerido, candado para fundamentales)

---

## 🎯 SPRINT 1: Visual & UX Inmediata (10h)

### ✅ COMPLETADO ANTES DE AGENTES
- ✅ Paleta CSS global (`theme-colors.css`)

### ⏳ EN PROGRESO (Agente 1)

#### 1.1 Font Awesome Icon System (4h)
**Archivos nuevos:**
- `src/shared/Icons.tsx` — wrapper de react-icons
- `src/shared/IconButton.css` — estilos botones

**Cambios:**
- Reemplazar emojis en TODOS los archivos
- ReservationsPage: ✓→✓, ✕→✕, ⊗→⊗, 📊→📊
- ClientsPage: usuarios, clientes, settings
- Botones: consistencia Font Awesome

**Commits esperados:**
- `feat: add Font Awesome icon system`

---

#### 1.2 Settings Consolidado (3h)
**Archivos nuevos:**
- `src/features/settings/SettingsPage.tsx`
- `src/features/settings/SettingsPage.css`

**Estructura:**
```
[Profile Tab]
  ├─ Nombre
  ├─ Email
  └─ [Guardar]

[Security Tab]
  ├─ Contraseña actual
  ├─ Nueva contraseña
  ├─ Repetir
  └─ [Cambiar]

[Enterprise Tab] (solo manager)
  ├─ Logo upload
  ├─ Nombre empresa
  └─ [Guardar]
```

**Ruta:** `/settings` (nueva ruta en router)

**Commits esperados:**
- `refactor: consolidate auth to settings page`

---

#### 1.3 Traffic Light Status (3h)
**Archivos nuevos:**
- `src/shared/StatusTrafficLight.tsx`
- `src/shared/StatusTrafficLight.css`

**Estados (colores corporativos):**
- 🟢 Confirmada (verde)
- 🟡 Pendiente (amarillo)
- 🔵 Asistida (cian corporativo)
- 🔴 No asistió (rosa)
- ⚪ Cancelada (gris)

**Integración:** ReservationsPage bandeja
- Click abre dropdown
- Estados: [Confirmar] [Pendiente] [Cancelar]
- Dispara mutation

**Commits esperados:**
- `feat: add traffic light status component`

---

## 🎯 SPRINT 2: Arquitectura & Funcionalidad (18h)

### ⏳ EN PROGRESO (Agente 2)

#### 2.1 Drag & Drop Fix (8h)
**Cambio:** dnd-kit (reemplaza implementación anterior)

**Archivos nuevos:**
- `src/features/forms/FormBuilderDnD.tsx`
- `src/features/forms/FormBuilderDnD.css`

**Características:**
- Sortable fields sin bug
- Drag handle visual
- Preview al arrastrar
- Validación: no puede drop en sí mismo
- Accordion: grupos colapsables

**Integración:** ReservationBuilderPage paso 1

**Commits esperados:**
- `fix: replace drag-drop with dnd-kit (bug fix)`

---

#### 2.2 Menú Responsive & Colapsable (6h)
**Archivos nuevos:**
- `src/core/Sidebar.tsx` (nueva, reemplaza navigation actual)
- `src/core/Sidebar.css`

**Características:**
- Desktop (768px+):
  - Ancho 280px → 60px colapsable
  - Ícono "<<" para contraer
  - Hover submenu
  
- Mobile (<768px):
  - Drawer fixed (left)
  - Overlay dark
  - Click overlay cierra

**Items navegación:**
```
Dashboard (home)
Reservas
├─ Formularios
├─ Bandeja
└─ Métricas
CRM (users)
Clientes (building)
Configuración (cog)
```

**Paleta:** Cian primary, rosa accent

**Commits esperados:**
- `feat: add responsive collapsible sidebar`

---

#### 2.3 Exportar Módulo (4h)
**Archivos nuevos:**
- `src/features/reservations/ExportModal.tsx`
- `src/features/reservations/ExportModal.css`

**Características:**
```
[Export modal]
├─ Rango fechas: [desde] [hasta]
├─ Formato: [CSV ▼] / JSON / PDF
├─ Campos (checkboxes):
│  ☑ Nombre
│  ☑ Teléfono
│  ☑ Email
│  ☑ Fecha
│  ☑ Estado
│  ☑ Asistencia
│  ☐ Notas internas
│  ☐ Campaña
└─ [Descargar] [Cancelar]
```

**Backend endpoint:** `POST /reservations/export`
- Genera CSV/JSON/PDF
- Retorna blob
- Descarga automática

**Integración:** Botón en ReservationsPage bandeja

**Commits esperados:**
- `feat: add export reservations module (CSV/JSON/PDF)`

---

## 🎯 SPRINT 3: Polish & Seguridad (9h)

### ⏳ EN PROGRESO (Agente 3)

#### 3.1 Logo Upload (2h)
**Archivos nuevos:**
- `src/features/clients/LogoUpload.tsx`
- `src/features/clients/LogoUpload.css`

**Características:**
- Preview thumbnail
- Upload a Cloudinary
- Eliminar logo
- Validación (solo imagen)

**Integración:** ClientsPage enterprise tab

**Commits esperados:**
- `feat: add logo upload for clients`

---

#### 3.2 Nomenclatura Clara (2h)
**Cambios:**
- "Campo protegido" → "Requerido" (badge rojo)
- "Name" / "Email" → icono 🔒 (fundamental)
- Labels editables en form builder
- Tooltip: "Este campo es fundamental"

**Archivos nuevos:**
- `src/shared/FieldLabel.tsx`

**Commits esperados:**
- `feat: add editable field labels & clear nomenclature`

---

#### 3.3 Notificaciones Center (2h)
**Archivos nuevos:**
- `src/shared/NotificationCenter.tsx`
- `src/shared/ProgressTicket.tsx`

**Características:**
```
Notificaciones (toast):
├─ ✓ Éxito (verde)
├─ ✕ Error (rojo)
├─ ⚠ Advertencia (amarillo)
└─ ℹ Info (cian)

Progress Ticket (form builder):
├─ [✓] Información básica
├─ [✓] Campos
├─ [→] Disponibilidad
├─ [ ] Diseño
└─ [ ] Revisión final
```

**Helper:** `notify(message, type, duration)`

**Commits esperados:**
- `feat: add notification center & progress tickets`

---

#### 3.4 Cloudinary Org by Client (3h)
**Cambios backend:**
- `src/core/cloudinary/cloudinary.service.ts`
- Estructura carpetas:
  ```
  vitahub/
  ├─ clients/{clientId}/
  │  └─ logos/, designs/, uploads/
  └─ team/
     └─ shared/
  ```

**Permisos:**
- Manager: ve solo su empresa
- Team (Vitamina): ve TODAS
- Admin: todo

**Commits esperados:**
- `feat: implement cloudinary organization by client`

---

## 📊 ESTADO DE ARCHIVOS

### Creados (Sprint 1)
- ✅ `apps/web/src/shared/theme-colors.css` (paleta)
- ⏳ `apps/web/src/shared/Icons.tsx`
- ⏳ `apps/web/src/shared/IconButton.css`
- ⏳ `apps/web/src/features/settings/SettingsPage.tsx`
- ⏳ `apps/web/src/features/settings/SettingsPage.css`
- ⏳ `apps/web/src/shared/StatusTrafficLight.tsx`
- ⏳ `apps/web/src/shared/StatusTrafficLight.css`

### Creados (Sprint 2)
- ⏳ `apps/web/src/features/forms/FormBuilderDnD.tsx`
- ⏳ `apps/web/src/features/forms/FormBuilderDnD.css`
- ⏳ `apps/web/src/core/Sidebar.tsx`
- ⏳ `apps/web/src/core/Sidebar.css`
- ⏳ `apps/web/src/features/reservations/ExportModal.tsx`
- ⏳ `apps/web/src/features/reservations/ExportModal.css`

### Creados (Sprint 3)
- ⏳ `apps/web/src/features/clients/LogoUpload.tsx`
- ⏳ `apps/web/src/features/clients/LogoUpload.css`
- ⏳ `apps/web/src/shared/FieldLabel.tsx`
- ⏳ `apps/web/src/shared/NotificationCenter.tsx`
- ⏳ `apps/web/src/shared/ProgressTicket.tsx`
- ⏳ `apps/api/src/infrastructure/migrations/AddClientLogo.ts`

### Modificados
- 📝 `apps/web/src/core/router.tsx` (ruta /settings)
- 📝 `apps/web/src/features/reservations/ReservationsPage.tsx` (StatusTrafficLight)
- 📝 `apps/web/src/features/forms/ReservationBuilderPage.tsx` (FormBuilderDnD)
- 📝 `apps/web/src/core/App.tsx` (Sidebar layout)
- 📝 `apps/api/src/modules/clients/client.entity.ts` (logo_url)
- 📝 `apps/api/src/core/cloudinary/cloudinary.service.ts` (org)

---

## 🎨 PALETA CORPORATIVA (Aplicada)

```css
:root {
  /* Primarios */
  --cian: #0EC6B8;
  --cian-dark: #0AA79B;
  
  /* Secundarios */
  --rosa: #EA0F63;
  --rosa-dark: #C50B52;
  
  /* Base */
  --negro: #000000;
  --blanco: #FFFFFF;
  
  /* Texto */
  --txt: #0B0B0C;
  --txt-secondary: #55575E;
  --txt-muted: #8A8D95;
  
  /* Componentes */
  --line: #E7E8EC;
  --gray: #F4F5F7;
  --dark-card: #131316;
}
```

**Aplicada en:**
- Botones primarios: cian
- Botones accent: rosa
- Bordes: line
- Superficies: gray
- Texto: txt / txt-secondary

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Sprint 1
- [ ] Font Awesome icons (4h)
- [ ] Settings consolidado (3h)
- [ ] Traffic light status (3h)

### Sprint 2
- [ ] Drag & drop fix (8h)
- [ ] Sidebar responsive (6h)
- [ ] Export module (4h)

### Sprint 3
- [ ] Logo upload (2h)
- [ ] Nomenclatura clara (2h)
- [ ] Notifications center (2h)
- [ ] Cloudinary org (3h)

---

## 🚀 PROXIMOS PASOS

1. **Esperar a que terminen los 3 agentes** (paralelos)
2. **Revisar commits** de cada agente
3. **Hacer merge** de todos los cambios
4. **Testing local:**
   - Desktop + mobile
   - Drag & drop
   - Export CSV/PDF
   - Logo upload
   - Settings
   - Notificaciones
5. **Commit final:** todos los cambios
6. **Demo con cliente**

---

## 📊 MÉTRICAS FINALES

| Métrica | Valor |
|---------|-------|
| Archivos nuevos | 20+ |
| Archivos modificados | 10+ |
| Líneas de código | 2000+ |
| Commits esperados | 15+ |
| Sprints | 3 |
| Horas estimadas | 37 |
| Agentes paralelos | 3 |
| Paleta aplicada | 100% |

---

**Autorizado por:** Usuario (exhaustivamente todo)  
**Ejecutado por:** Claude + 3 agentes  
**Estimación:** Realista (37h con agentes paralelos)  
**Riesgo:** Bajo (componentes aislados, sin breaking changes)

---

**ESTADO ACTUAL:** 🔄 En progreso (waiting for agents to complete)  
**PRÓXIMA ACTUALIZACIÓN:** Cuando terminen los agentes

