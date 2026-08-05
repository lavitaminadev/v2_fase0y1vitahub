# Seguridad: control de accesos y riesgo residual

Fecha de corte: 5 de agosto de 2026
Alcance: VITAHUB — plataforma interna de La Vitamina.

---

## 1. Qué es y qué no es este sistema

VITAHUB **no es un SaaS multi-empresa**. Opera una sola organización: La Vitamina. Los
clientes de la agencia son *datos* dentro de esa organización, no inquilinos con su propia
frontera. Quienes usan el sistema son el equipo interno, repartido en áreas, más los
contactos de cliente que entran a un portal acotado.

De ahí que el control de accesos tenga dos ejes independientes que hay que distinguir:

| Eje | Pregunta que responde | Dónde se configura |
|---|---|---|
| **Módulo** | ¿Qué pantallas puede usar esta persona? | Cargo + excepción por persona |
| **Cuenta** | ¿De qué clientes puede ver los datos? | Pod + asignación directa |

Una persona puede tener `manage` sobre Producción y aun así no ver ninguna pieza, porque no
tiene cuentas asignadas. Son controles que se multiplican, no que se sustituyen.

---

## 2. Cómo se decide cada acceso

### 2.1 Acceso a un módulo

Tres condiciones en cadena; basta que una falle para denegar:

1. **El módulo está encendido en la organización** (`organizations.features`). Un módulo
   apagado no lo alcanza nadie, incluida la administración. Es la forma de congelar una fase
   sin borrar el código.
2. **El cargo concede el nivel** (`role-permissions.ts`). Vive en código porque qué puede
   hacer un community manager es una definición de producto, no un dato operativo.
3. **No hay una excepción que lo rebaje** (`user_permission_overrides`). Las desviaciones
   para una persona concreta sí son datos.

Niveles, de menor a mayor: `none` → `view` → `edit` → `manage`. Cada uno incluye a los
anteriores.

El nivel que exige un endpoint se deduce de su verbo cuando no declara otro: consultar pide
`view`, crear o modificar piden `edit`, borrar pide `manage`.

### 2.2 Acceso a una cuenta

Tres vías que **se suman**:

1. **Pod** — quien integra un pod ve las cuentas del pod. Es la vía normal y la única sin
   mantenimiento aparte.
2. **Asignación directa** (`user_client_access`) — excepciones para prestar una cuenta sin
   mover a nadie de pod ni alterar su capacidad.
3. **Community manager** — la cuenta apunta a la persona en `clients.community_manager_id`.

**Solo el cargo `admin` ve todas las cuentas sin asignación.** Las direcciones también se
acotan: dirigir un área no implica necesitar los datos de todas las cuentas, y acotarlo
limita lo que queda expuesto si una sesión se ve comprometida.

`GET /api/users/:id/client-access` responde qué cuentas ve una persona **y por qué** —
distingue lo heredado del pod de lo concedido a mano.

---

## 3. Qué se corrigió en esta iteración

### 3.1 Los permisos configurados no se aplicaban

**Hallazgo.** Existían dos sistemas de autorización en paralelo. `@Roles(...)` decidía en 204
endpoints; `@RequiresPermission` —el único que consulta las excepciones por persona y el
interruptor de módulos— estaba puesto en 2 de 280. `PermissionGuard` dejaba pasar sin
consultar nada cualquier endpoint no anotado.

**Consecuencia.** Quitarle un módulo a alguien desde la pantalla de permisos ocultaba su
menú, **pero la API seguía respondiendo**. La pantalla de permisos era decorativa. Cualquiera
con una sesión válida y el cargo adecuado alcanzaba datos que se creían restringidos
llamando la API directamente.

**Corrección.** Los 46 controladores declaran su módulo (`@ModuleScope`) o una exención
justificada (`@ModuleExempt`). El guard **niega por omisión**: un endpoint sin módulo
declarado se rechaza y se registra en el log de la aplicación. `@Roles` se conserva y sigue
aplicándose, de modo que ambos controles deben pasar.

### 3.2 Todo el equipo veía todas las cuentas

**Hallazgo.** `allowedClientIds()` devolvía "sin límite" para todos los cargos salvo
community manager y cliente. Un diseñador o un audiovisual alcanzaba los datos de todos los
clientes de la agencia.

**Corrección.** Alcance por pod más asignación directa, descrito en 2.2. La migración
`0072` siembra como asignaciones explícitas el acceso que cada cargo ya ejercía, de modo que
el cambio sea de control y no de operación; el recorte se hace después desde la pantalla,
con el efecto a la vista.

### 3.3 La organización se podía elegir desde la petición

**Hallazgo.** `TenantMiddleware` leía la cabecera `x-organization-id` y la fijaba en la
petición **antes de autenticar**. En rutas públicas el guard de tenancy retornaba temprano,
así que ese valor sobrevivía hasta el subscriber de TypeORM, que estampaba `organization_id`
en las filas insertadas. El frontend nunca envió esa cabecera: era superficie de ataque sin
uso legítimo.

**Corrección.** El módulo de tenancy se reemplazó por un contexto de organización que se
deriva **solo del JWT ya verificado**. El registro público dejó de crear organizaciones —se
incorpora a `AGENCY_ORGANIZATION_ID`— y dejó de otorgar el cargo de administración, que era
una escalada de privilegios accesible desde Internet cuando se habilitaba.

La columna `organization_id` se conserva en las 44 entidades: eliminarla obligaba a reescribir
1.233 sitios de código y rehacer 78 índices sin resolver ningún problema de seguridad.

---

## 4. Riesgos de la lista original ya cubiertos

Verificado contra el código, no contra la memoria:

| Riesgo | Control existente |
|---|---|
| JWT/refresh | Refresh hasheado SHA-256, rotado en cada uso, revocado al cambiar contraseña. Los access tokens emitidos antes del último cambio de contraseña se rechazan. Bloqueo de cuenta a los 5 intentos por 15 minutos. Comparación contra hash ficticio cuando el correo no existe, para que el tiempo de respuesta no revele qué cuentas están registradas. |
| Validación de entrada | `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`: los campos no declarados se rechazan. |
| Cifrado de tokens de terceros | AES-256-GCM en `shared/security/integration-secrets.ts`. |
| Idempotencia | Clave de idempotencia en reservas y en la captura pública de leads. |
| Concurrencia | 19 bloqueos `pessimistic_write` en reservas, presupuesto UD, XP y outbox. |
| Outbox | Meta y Google, con bloqueo, reintentos y clasificación de errores recuperables. |
| Auditoría | `AuditInterceptor` global. Los cambios de permiso y de acceso a cuentas registran quién, cuándo, antes y después. |
| Monitoreo | Sondas de salud, métricas, registro estructurado con id de petición. |
| Cabeceras y transporte | Helmet con CSP restrictiva, CORS por lista blanca. |

---

## 5. Riesgo residual

No existe seguridad absoluta. Lo que sigue permanece abierto, con su tratamiento decidido.

### R-01 · `@Roles` puede contradecir a los permisos configurados
- **Activo.** Autorización de los 204 endpoints con `@Roles`.
- **Probabilidad.** Media · **Impacto.** Bajo
- **Control existente.** Ambos controles se aplican y deben pasar los dos, por lo que el
  resultado nunca es más permisivo que `@Roles`.
- **Limitación conocida.** *Ampliar* el acceso de alguien mediante una excepción no surte
  efecto si `@Roles` no incluye su cargo. Las excepciones que restringen sí funcionan; las
  que conceden, no siempre.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de noviembre de 2026
- **Tratamiento.** Mitigar — retirar `@Roles` por módulo una vez que la cobertura de
  permisos lleve un ciclo completo sin incidencias (ver roadmap I-1).

### R-02 · Ventana de 30 segundos al revocar un acceso
- **Activo.** Alcance por módulo y por cuenta.
- **Probabilidad.** Alta · **Impacto.** Bajo
- **Control existente.** Ambas cachés se descartan explícitamente al cambiar permisos, pods o
  asignaciones. El vencimiento de 30 segundos es solo la red de seguridad.
- **Limitación conocida.** Un cambio hecho fuera de esas vías —por ejemplo, editar la base
  de datos a mano— tarda hasta 30 segundos en surtir efecto.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de febrero de 2027
- **Tratamiento.** Aceptar — la exposición es de 30 segundos sobre datos que la persona vio
  legítimamente hasta ese momento.

### R-03 · Un access token robado sirve hasta que expira
- **Activo.** Sesiones del equipo.
- **Probabilidad.** Baja · **Impacto.** Alto
- **Control existente.** Cambiar la contraseña invalida de inmediato todos los tokens
  emitidos antes. El refresh token se rota en cada uso.
- **Limitación conocida.** No hay forma de expulsar una sesión concreta sin cambiar la
  contraseña, ni lista de revocación por token.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de noviembre de 2026
- **Tratamiento.** Mitigar — sesiones con identificador propio y cierre selectivo (I-3).

### R-04 · Sin segundo factor
- **Activo.** Todas las cuentas, en particular las de administración.
- **Probabilidad.** Media · **Impacto.** Crítico
- **Control existente.** Bloqueo por intentos fallidos, límite de peticiones por IP,
  contraseña propia obligatoria en el primer ingreso.
- **Limitación conocida.** Una contraseña filtrada o reutilizada basta para entrar. En una
  cuenta `admin` eso es acceso a todas las cuentas de la agencia.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de octubre de 2026
- **Tratamiento.** Mitigar — segundo factor obligatorio para `admin` y direcciones (I-2).
  **Es el riesgo abierto más grave.**

### R-05 · HTTPS depende del alojamiento
- **Activo.** Credenciales, cookies y datos de reserva en tránsito.
- **Probabilidad.** Baja · **Impacto.** Crítico
- **Control existente.** CSP y CORS configurados en la aplicación.
- **Limitación conocida.** La aplicación no impone HTTPS ni envía HSTS: depende de cómo esté
  configurado cPanel. **Sin verificar a la fecha de corte.**
- **Responsable.** Dirección de Operaciones
- **Revisión.** Inmediata
- **Tratamiento.** Eliminar — redirección forzada y HSTS (I-0). **Verificar antes que nada.**

### R-06 · Respaldo sin restauración probada
- **Activo.** Reservas, contactos y trazabilidad completa.
- **Probabilidad.** Media · **Impacto.** Crítico
- **Control existente.** Los respaldos que provea el alojamiento. **Sin verificar.**
- **Limitación conocida.** Un respaldo que nunca se restauró no es un respaldo, es una
  suposición. No hay constancia de una restauración exitosa.
- **Responsable.** Dirección de Operaciones
- **Revisión.** Inmediata
- **Tratamiento.** Eliminar — restauración probada sobre una base desechable, con acta (I-0).

### R-07 · El cron depende de un disparador externo
- **Activo.** Conversiones hacia Meta y Google, avisos operativos, ciclos mensuales.
- **Probabilidad.** Media · **Impacto.** Alto
- **Control existente.** Endpoints de cron protegidos por secreto con comparación de tiempo
  constante; el outbox reintenta y no pierde eventos.
- **Limitación conocida.** Si el cron de cPanel deja de llamar, la cola crece en silencio.
  Nadie se entera hasta que un cliente reclama que no llegan conversiones.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de septiembre de 2026
- **Tratamiento.** Mitigar — aviso cuando la cola supere un umbral o cuando no haya habido
  ejecución en el plazo esperado (I-4).

### R-08 · Los fallos se descubren por reclamo del cliente
- **Activo.** Continuidad del servicio.
- **Probabilidad.** Alta · **Impacto.** Medio
- **Control existente.** Sondas de salud y métricas expuestas.
- **Limitación conocida.** Nadie las consulta de forma automática: no hay monitor externo ni
  aviso cuando la sonda responde 503.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de septiembre de 2026
- **Tratamiento.** Mitigar — monitor externo sobre `/api/health` con aviso (I-4).

### R-09 · El código no está bajo control de versiones
- **Activo.** Todo el código.
- **Probabilidad.** Alta · **Impacto.** Crítico
- **Control existente.** Ninguno. El repositorio no tiene ni un solo commit y conviven varias
  copias del proyecto en el disco.
- **Limitación conocida.** No se puede saber qué cambió, ni quién lo cambió, ni volver atrás.
  Un borrado accidental es definitivo.
- **Responsable.** Dirección de Operaciones
- **Revisión.** Inmediata
- **Tratamiento.** Eliminar — primer commit y repositorio remoto (I-0). **Es la brecha más
  barata de cerrar y la que más protege.**

### R-10 · Cobertura del alcance por cuenta no verificada endpoint por endpoint
- **Activo.** Datos de clientes.
- **Probabilidad.** Media · **Impacto.** Alto
- **Control existente.** `AccountAccessService` se invoca en 21 controladores. El alcance por
  módulo sí es exhaustivo y actúa como primera barrera.
- **Limitación conocida.** A diferencia del alcance por módulo, el alcance por cuenta **no
  niega por omisión**: un endpoint que consulte datos de cliente sin llamar a
  `allowedClientIds()` los devuelve todos. No está auditado uno por uno.
- **Responsable.** Dirección de Operaciones
- **Revisión.** 5 de octubre de 2026
- **Tratamiento.** Mitigar — auditar los endpoints que tocan datos de cliente y estudiar un
  filtro por omisión a nivel de consulta (I-5).

---

## 6. Resumen del riesgo abierto

| Id | Riesgo | Prob. | Impacto | Tratamiento | Revisión |
|---|---|---|---|---|---|
| R-09 | Sin control de versiones | Alta | Crítico | Eliminar | Inmediata |
| R-05 | HTTPS sin verificar | Baja | Crítico | Eliminar | Inmediata |
| R-06 | Respaldo sin probar | Media | Crítico | Eliminar | Inmediata |
| R-04 | Sin segundo factor | Media | Crítico | Mitigar | 05-10-2026 |
| R-10 | Alcance por cuenta sin auditar | Media | Alto | Mitigar | 05-10-2026 |
| R-03 | Token robado hasta expirar | Baja | Alto | Mitigar | 05-11-2026 |
| R-07 | Cron sin verificar | Media | Alto | Mitigar | 05-09-2026 |
| R-08 | Sin monitoreo activo | Alta | Medio | Mitigar | 05-09-2026 |
| R-01 | `@Roles` puede contradecir | Media | Bajo | Mitigar | 05-11-2026 |
| R-02 | Ventana de caché de 30 s | Alta | Bajo | Aceptar | 05-02-2027 |

Los tres primeros no son trabajo de programación: son configuración y verificación, y son
los que más protegen por unidad de esfuerzo.
