# Auditoría completa del código

Revisión del backend, frontend, migraciones y documentación en tres frentes:
seguridad, fallos de interfaz y consistencia entre documentación y código.

**Total: 80 hallazgos. 41 corregidos, 39 pendientes con decisión indicada.**

---

## Corregido

### Seguridad

| # | Hallazgo | Severidad |
| --- | --- | --- |
| S1 | `GET /cloudinary/resources` sin `clientId` listaba recursos de todas las organizaciones. El prefijo ahora incluye siempre la organización | **Alta** |
| S2 | `DELETE /uploads/images/cloudinary/:publicId` no verificaba propiedad del recurso. Ahora valida prefijo antes de destruir | **Alta** |
| S3 | El `userId` de XP no se validaba contra la organización. Ahora se comprueba pertenencia antes de crear | Media |
| S4 | El reset administrativo y la actualización de usuario no actualizaban `passwordChangedAt`. Ya se invalida correctamente la línea temporal de tokens | Media |
| S5 | `GET /health` público exponía base, memoria y disco. Ahora sólo deja estado agregado; el detalle vive en `/health/details` | Media |
| P1 | `assertClientAccess` de reuniones no rechazaba reuniones internas sin cliente para CM/cliente. Ya replica el patrón restrictivo del CRM | Baja |
| P2 | `POST /reservations/forms/:id/export` usaba tipo inline y se saltaba `ValidationPipe`. Ahora usa DTO validado | Baja |
| P3 | `POST /reservations/forms/:id/blocks/batch` no validaba elementos ni tope. Ahora usa `ParseArrayPipe` con límite | Baja |
| P4 | `POST /public/reservations/:slug/coupon-validate` aceptaba `code` sin tipar y podía lanzar 500. Ahora usa DTO | Baja |

### Interfaz

| # | Hallazgo | Severidad |
| --- | --- | --- |
| F1 | La exportación de reservas nunca funcionaba por ruta incorrecta, llamada sin auth y filtro vacío | **Alta** |
| F2 | La exportación ofrecía “Notas internas” al cliente. Ya quedó filtrado y oculto | **Alta** |
| F3 | La idempotencia de reserva se reciclaba en la misma pestaña. La clave ahora se renueva correctamente | **Alta** |
| F4 | “Agregar reserva manual” aparecía en el portal cliente y devolvía 403 | Media |
| P5 | `ClientRoute` no validaba `mustChangePassword` | Media |
| P6 | “Analítica de reservas” renderizaba un bloque vacío. Ya reutiliza la implementación visible | Media |
| P7 | El portal del cliente mostraba acciones internas del Pulso con enlaces que rebotaban | Media |
| P8 | En `/portal/reservations` seguían activos controles internos que devolvían 403 | Media |
| P9 | La navegación del portal ofrecía menos destinos que el inicio | Baja |
| P10 | `CatalogQuotesTab` y `CatalogPage` no distinguían vacío real de carga fallida. Ya muestran error visible | Baja |
| P11 | La tasa de uso de cupones podía mostrar `NaN%` | Baja |
| P12 | `/change-password` pedía `/organizations` a roles sin acceso | Baja |
| P13 | Los errores visibles del flujo de autenticación llegaban en inglés. El flujo principal ya quedó en español | Baja |
| P14 | Google seguía con callback registrada pese a estar fuera de Fase 1. Se retiró la callback y el componente muerto asociado | Baja |
| P15 | El buscador de cupones no tenía `value` ni `onChange` | Baja |
| P18 | `JSON.parse` sin `Array.isArray` en widgets/vistas guardadas | Baja |
| P19 | `localStorage.setItem` sin `try/catch` al ordenar columnas | Baja |
| P22 | La tarjeta del portal decía “Reportes” mientras la pantalla decía “Mis informes” | Baja |
| P23 | Se amplió el saneamiento de URLs con `safeUrl()` en aprobaciones, documentos, cliente y flujo principal de reservas | Baja |

### Consistencia y despliegue

| # | Hallazgo |
| --- | --- |
| C1 | `ihosting.md` documentaba mal el comando de cron |
| C2 | `apps/api/.env.example` omitía variables requeridas |
| C3 | `VITE_APP_PUBLIC_URL` faltaba en plantillas productivas |
| C4 | `JWT_EXPIRES_IN=24h` en ejemplo contra `15m` real |
| C5 | Tres documentos indicaban `cp .env.example .env` inexistente |
| C6 | README ubicaba el `.env` en `apps/api/` en vez de la raíz |
| C7 | “Manual setup” corría seed sin migraciones previas |
| C8 | `npm run migration:generate` documentado sin existir |
| C9 | Dependencias frontend usadas sin declarar |
| C10 | README desactualizado en versiones y diagrama |
| C11 | README omitía `reservations` y otros módulos |
| C12 | Referencia residual al sistema reemplazado |
| C13 | Migración `0034` no reejecutable |
| C14 | Migraciones `0056` y `0057` sin guardas |
| P44 | El enum de estados de lead se derivó desde `shared` y se eliminó la copia incompleta |
| P47 | La creación de usuarios ya respeta `BCRYPT_ROUNDS` |
| P49 | Se retiró `NEXT_PUBLIC_APP_URL` como fallback del redirect OAuth |

---

## Pendiente — interfaz

| # | Hallazgo | Severidad | Decisión sugerida |
| --- | --- | --- | --- |
| P16 | Filtros sin nombre accesible en audiovisual, briefs y facturación | Baja | Añadir `aria-label` |
| P17 | Hay archivos no importados y duplicados documentados en `LIMPIEZA-CANDIDATOS.md` | Baja | Resolver limpieza por lote separado |
| P20 | Aún quedan textos con codificación rara, sin acentos o inconsistentes fuera de las pantallas ya corregidas | Baja | Hacer una pasada textual completa |
| P21 | El informe mensual proponía un período incorrecto al abrirse en enero | Baja | Ajustar cálculo del período |
| P23 | Todavía quedan URLs por revisar fuera del circuito principal ya saneado | Baja | Completar adopción de `safeUrl()` |

---

## Pendiente — consistencia

| # | Hallazgo | Decisión sugerida |
| --- | --- | --- |
| P24 | `.env.override` afirma una validación que no ocurre | Decidir si el archivo sigue vivo |
| P25 | Cuatro plantillas de entorno para un único `.env` real | Consolidar |
| P26 | `scripts/validate-env.js` no está alineado con `environment.ts` | Corregir o retirar |
| P27 | `setup-crontab.sh` y la documentación usan rutas distintas | Unificar |
| P28 | El rollback documentado usa un comando PowerShell no portable a Linux | Cambiar al equivalente real |
| P29 | `migration:revert` no advierte que `0019` es irreversible | Documentar |
| P30 | `DEVELOPMENT.md` afirma `synchronize: true` y el código usa `false` | Corregir |
| P31 | `DEVELOPMENT.md` y `DEPLOY.md` listan variables no leídas y omiten reales | Corregir |
| P32 | `API.md` sigue desalineado con auth, organizations y reservations | Actualizar o marcar como desactualizado |
| P33 | `DATABASE.md` no refleja reservas ni la estructura real | Corregir |
| P34 | `01-ESTADO-ACTUAL.md` tiene cifras de migraciones y tests desactualizadas | Actualizar |
| P35 | `06-RESERVATIONS.md` lista menos migraciones de las reales | Completar |
| P36 | `00-BASELINE-ANTES-DE-CORRECCIONES.md` sigue marcado como vigente siendo histórico | Archivar |
| P37 | `FASE_1_CHECKLIST.md` mezcla `crm_enabled` con `meta_capi_enabled` y define mal `fbp` | Corregir |
| P38 | `DEVELOPMENT.md` mantiene codificación defectuosa y requisito de npm desactualizado | Corregir |
| P39 | El hueco `0035–0049` sigue sin explicación documental | Documentar |
| P40 | `0050` declara un índice redundante | Retirar esa entrada |
| P41 | Persisten dos convenciones de timestamps y nombres en migraciones | Definir convención nueva |
| P42 | Quedan restos muertos del antiguo alcance por cliente en reuniones | Limpiar |
| P43 | Conviven `@nestjs/axios` y `fetch` | Elegir uno |
| P45 | Persisten dos mapas de etiquetas de estado | Unificar |
| P46 | `apps/api/src/config/index.ts` y `THROTTLE_*` siguen desalineados con el código | Conectar o retirar |
| P48 | Hay tablas históricas sin entidad/uso explícito | Documentar |
| P50 | Siguen convenciones mixtas de singular/plural y prefijos | Acordar convención futura |
| P51 | Algunas rutas no siguen el nombre del módulo | Unificar |
| P52 | Siguen mezclas de comillas y `@ApiTags` en idiomas distintos | Dejar al linter o normalizar |
| P53 | Quedan referencias a `hubvit` en guías/script | Corregir |
| P54 | Proveedores válidos sin implementación real | Reducir al conjunto real |

---

## Verificado y limpio

- No se detectó `dangerouslySetInnerHTML`.
- Los parseos críticos revisados ya están bajo `try/catch`.
- No se están guardando tokens o secretos sensibles en `localStorage`.
- El widget del dashboard y `Ctrl + K` respetan permisos/navegación activa.
- Las notificaciones de sistema quedaron sólo para `admin`.
- Google sigue fuera del alcance de Fase 1; reservas + CRM + Meta continúa siendo la prioridad.

---

## Estado revalidado

Revalidado contra código y alcance al **Monday, July 27, 2026** usando como fuente de verdad:

- `VitaHub_Plan_de_Desarrollo_y_Brief-1.md`
- `VitaHub_CRM_Reservas_y_Meta.md`
- `Estructura de Operación La Vitamina.md`

Verificación técnica final:

- `cmd /c npm test -- --runInBand` ejecutado con éxito.
- Backend: `58/58` archivos de prueba en verde, `286/286` tests en verde.
- Frontend: `3/3` archivos de prueba en verde, `16/16` tests en verde.

---

## Método

Tres revisiones cruzadas sobre el árbol completo, cada hallazgo verificado leyendo código y documentación antes de afirmarlo.

Excluido por decisión previa:

- La vulnerabilidad de `typeorm` por política de no mover versiones.
- `infrastructure/` con contenedores y monitoreo.
- Los candidatos de limpieza ya listados en `LIMPIEZA-CANDIDATOS.md`.
- Los avisos de `only-export-components`.
