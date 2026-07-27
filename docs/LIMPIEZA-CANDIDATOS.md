# Candidatos de limpieza

Inventario de código sin consumidores detectado por análisis estático. **Nada de esta lista
se ha eliminado**: cada punto necesita una decisión, porque "sin consumidores hoy" no
siempre significa "eliminable".

Método: `oxlint` para imports y variables sin uso, más una búsqueda de cada símbolo
exportado en `apps/api/src` y `apps/web/src`.

---

## 1. Ya eliminado

Imports y parámetros sin uso que `oxlint` señaló y no tenían ambigüedad.

| Archivo | Qué se quitó |
| --- | --- |
| `modules/crm/opportunities/opportunity.entity.ts` | `Lead`, `Client` |
| `modules/crm/interactions/interaction.entity.ts` | `Lead`, `Contact` |
| `modules/gamification/xp-event.entity.ts` | `User` |
| `modules/design-budget/get-or-create-budget.use-case.ts` | `UDMovementType` |
| `modules/clients/clients.controller.ts` | `DataSource` |
| `core/audit/audit.interceptor.ts` | `randomUUID` |
| `modules/meetings/dto/update-action-item.dto.ts` | `MaxLength` |
| `core/cron/cron.controller.ts` | `Query` |
| `modules/catalog/quotes.service.ts` | Parámetro `userId` renombrado a `_userId` |
| `features/forms/index.ts` | `export type {}` vacío |
| `features/reservations/ReservationsPage.tsx` | Bloque `NEXT_STATUSES` comentado |

Backend y frontend quedan sin avisos de variables o imports sin uso.

---

## 2. Contratos compartidos sin adoptar — decisión de arquitectura

`packages/shared/src/types/` exporta 38 tipos que ninguna aplicación importa. Las pantallas
y los controladores declaran sus propias interfaces locales en su lugar.

| Grupo | Símbolos |
| --- | --- |
| Respuestas de API | `ApiResponse`, `PaginatedResponse`, `ApprovalResponse`, `BillingResponse`, `ClientResponse`, `ContentGridResponse`, `ContentItemResponse`, `IntegrationResponse`, `LeadResponse`, `MeetingResponse`, `NotificationResponse`, `OrganizationResponse`, `PieceResponse`, `PieceVersionResponse`, `UdBudgetResponse`, `UdMovementResponse`, `UserResponse`, `XpEventResponse`, `XpPeriodResponse` |
| Peticiones | `CreateClientRequest`, `CreateLeadRequest`, `CreateUserRequest`, `UpdateUserRequest`, `LoginRequest`, `RegisterRequest` |
| Enumeraciones | `ApprovalEntityType`, `ApprovalStatus`, `BillingPeriod`, `BillingStatus`, `NotificationType`, `UdBudgetStatus`, `UdMovementType`, `XpEventType`, `XpPeriodStatus`, `UserWorkMode` |
| Varios | `DateRange`, `OrganizationSettings`, `UserDto` |

**No eliminar todavía.** Son el contrato que evita que backend y frontend definan la misma
forma dos veces, que es la clase de divergencia que ya apareció entre el menú y los
permisos. Hay dos caminos y conviene elegir uno de forma explícita:

- **Adoptarlos.** Reemplazar las interfaces locales por estos tipos, empezando por los
  módulos de Fase 1 (`LeadResponse`, `ClientResponse`, `UserResponse`). El beneficio es que
  un cambio en el backend rompe la compilación del frontend en lugar de fallar en ejecución.
- **Eliminarlos.** Aceptar que cada aplicación declare lo suyo y dejar `shared` solo para lo
  que hoy sí se usa: `UserRole`, `AuthResponse`, `LeadStatus` y las constantes de etapas.

Mientras la decisión esté abierta, mantenerlos no cuesta nada: son tipos, no llegan al
bundle.

---

## 3. Falsos positivos verificados

| Símbolo | Por qué se conserva |
| --- | --- |
| `LEAD_STATUSES` | Compone el tipo `LeadStatus` dentro del propio paquete |
| `LEAD_FIT_STATUSES` | Compone el tipo `LeadFitStatus` |
| `LEAD_RESERVATION_OUTCOMES` | Compone `LEAD_STATUSES` y define los estados que escribe el flujo de reservas |
| `getFeatureForPath` | Lo usa `isPathEnabled` en el mismo archivo |

---

## 4. Infraestructura sin uso en el camino de producción

| Ruta | Estado |
| --- | --- |
| `infrastructure/docker-compose.yml`, `docker-compose.test.yml`, `deployment/Dockerfile.api` | Alternativa de desarrollo local. El despliegue es cPanel con Passenger |
| `infrastructure/monitoring/` | Prometheus y Grafana, no conectados a la aplicación |
| `infrastructure/cron/crontab` | Reemplazado por `scripts/deploy/setup-crontab.sh`. Se conserva como referencia con una nota que lo advierte |

**Recomendación:** conservar. No estorban al despliegue y borrar un `docker-compose` que
alguien use en local es una molestia sin ganancia.

---

## 5. Deuda conocida, no eliminable

| Punto | Detalle |
| --- | --- |
| `reports`, `content`, `approvals`, `meetings` sin `@RequiresFeature` | Sus endpoints los consumen el dashboard y el portal del cliente. Cerrar el gate exige separar esos endpoints de los de Fase 4 |
| `typeorm` y su cadena de vulnerabilidades | El único arreglo publicado es TypeORM 1.1.0, un cambio de versión mayor |
| 5 avisos de `only-export-components` | Archivos compartidos que exportan constantes junto a componentes. Silenciarlos exige partirlos, por una comodidad de recarga en desarrollo |
| 13 módulos de backend sin pruebas | Todos de Fase 4 |
