# Roadmap de iteraciones

Fecha de corte: 5 de agosto de 2026
Riesgos referenciados: [07-SEGURIDAD-RIESGO-RESIDUAL.md](07-SEGURIDAD-RIESGO-RESIDUAL.md)

Cada iteración se ordenó por riesgo cubierto dividido por esfuerzo, no por lo que resulta
más entretenido de construir. Lo primero de la lista no tiene código.

---

## I-0 · Antes de cualquier otra cosa — configuración y verificación

Cubre R-09, R-05, R-06. **Sin programación.** Es lo que más protege por unidad de esfuerzo y
lo único que no puede esperar a la iteración siguiente.

### I-0.1 Poner el código bajo control de versiones · R-09
El repositorio no tiene ni un solo commit, y en el disco conviven `v2_fase0y1vitahub`,
`vitahub-platform` y cuatro carpetas de despliegue. Hoy no hay forma de saber qué cambió,
quién lo cambió ni de volver atrás.

- Confirmar cuál es la copia vigente. Todo apunta a `v2_fase0y1vitahub`: es la que abre
  `.claude/launch.json` y la que tiene las migraciones hasta la 0070.
- Verificar que `.gitignore` cubre `node_modules`, `.env`, `*.zip` y las carpetas de
  despliegue antes del primer commit.
- **Comprobar que ningún `.env` con credenciales entre en el commit.** Un secreto commiteado
  sigue en el historial aunque se borre después.
- Primer commit y repositorio remoto privado.
- Archivar las copias antiguas fuera del directorio de trabajo.

**Terminado cuando** `git log` muestra el primer commit y `git status` sale limpio.

### I-0.2 Verificar HTTPS · R-05
- Confirmar que el certificado está vigente y que `http://` redirige a `https://`.
- Añadir HSTS en la configuración de Helmet una vez confirmada la redirección — activarlo
  antes deja el sitio inaccesible si HTTPS falla.

**Terminado cuando** una petición a `http://` responde 301 y la respuesta incluye
`Strict-Transport-Security`.

### I-0.3 Probar la restauración del respaldo · R-06
Un respaldo que nunca se restauró es una suposición, no un respaldo.

- Restaurar el último respaldo sobre una base desechable.
- Contar reservas, contactos y usuarios; comparar con producción.
- Dejar acta con fecha, tamaño y tiempo que tomó.

**Terminado cuando** existe el acta de una restauración exitosa.

---

## I-1 · Retirar `@Roles` por módulo · R-01

Hoy conviven dos controles. Ambos se aplican, así que el resultado nunca es más permisivo
que `@Roles`, pero una excepción que *concede* acceso no surte efecto si el cargo no está en
la lista del decorador. Eso desconcierta a quien administra: da el permiso, y no pasa nada.

**Precondición.** Un ciclo completo con los permisos ya cerrados y sin incidencias.

- Revisar los registros en busca de `Endpoint sin módulo declarado` — si aparece alguno, hay
  un endpoint mal declarado que hay que corregir antes de seguir.
- Módulo por módulo: comprobar que `ROLE_PERMISSIONS` concede lo que `@Roles` concedía, y
  recién entonces retirar el decorador de ese módulo.
- Empezar por un módulo de bajo impacto —`dashboard`, `reports`— y no por `clients`.

**Terminado cuando** ningún endpoint declara `@Roles` salvo los exentos, y la matriz de
cargos es la única fuente.

---

## I-2 · Segundo factor · R-04

**Es el riesgo abierto más grave.** Una contraseña filtrada o reutilizada basta hoy para
entrar; en una cuenta `admin`, eso es acceso a todas las cuentas de la agencia.

- TOTP (aplicación de autenticación), no SMS.
- Obligatorio para `admin` y cargos de dirección; opcional para el resto en una primera
  etapa.
- Códigos de recuperación de un solo uso, mostrados una vez.
- Registrar en auditoría la activación y cada uso de un código de recuperación.

**Terminado cuando** una cuenta `admin` no puede iniciar sesión sin segundo factor.

---

## I-3 · Sesiones con cierre selectivo · R-03

Hoy la única forma de expulsar una sesión es cambiar la contraseña, lo que expulsa todas.

- Tabla de sesiones con identificador propio, dispositivo, IP y último uso.
- El refresh token referencia una sesión en vez de vivir suelto en la fila del usuario.
- Pantalla "mis sesiones" con cierre individual.
- Cierre forzado de las sesiones de otra persona desde administración.

**Terminado cuando** se puede cerrar una sesión concreta sin afectar a las demás.

---

## I-4 · Vigilancia activa · R-07, R-08

Los fallos se descubren hoy porque un cliente reclama.

- Monitor externo sobre `/api/health` con aviso cuando responda 503 o no responda.
- Aviso cuando la cola del outbox supere un umbral, o cuando no haya habido ejecución de
  cron en el plazo esperado. **Un cron que dejó de correr no genera errores: genera
  silencio**, y el silencio es indistinguible del buen funcionamiento sin esta alarma.
- Aviso ante una ráfaga de 5xx.
- Destino: correo de dirección más un canal de chat.

**Terminado cuando** una caída provocada a propósito genera un aviso en menos de 5 minutos.

---

## I-5 · Auditar el alcance por cuenta · R-10

El alcance por módulo niega por omisión; el alcance por cuenta no. Un endpoint que consulte
datos de cliente sin llamar a `allowedClientIds()` los devuelve todos.

- Inventariar los endpoints que devuelven datos ligados a un cliente.
- Contrastar contra los 21 controladores que hoy invocan `AccountAccessService`.
- Corregir los que falten.
- Estudiar un filtro por omisión a nivel de consulta, análogo a lo que hace el guard con los
  módulos, para que la omisión deje de ser posible en vez de solo estar corregida.
- Pruebas por cargo: un diseñador sin cuentas no debe recibir ni una fila de cliente.

**Terminado cuando** existe el inventario y cada endpoint de la lista está verificado.

---

## I-6 · Pantalla de accesos

El backend ya responde qué ve cada persona y por qué
(`GET /api/users/:id/client-access`). Falta la pantalla que lo muestre.

- Vista por persona: módulos con su nivel y procedencia, cuentas con su procedencia.
- Distinguir visualmente lo heredado del pod de lo concedido a mano.
- Conceder y retirar cuentas exigiendo un motivo.
- Al retirar una asignación, advertir si la cuenta le sigue siendo visible por su pod — el
  backend ya devuelve `stillVisible` justamente para eso, para que nadie crea haber cerrado
  algo que sigue abierto.
- Vista inversa por cuenta: quién la ve.

**Terminado cuando** dirección puede responder "¿quién ve esta cuenta?" sin consultar la
base de datos.

---

## I-7 · Revisión periódica de accesos

Los permisos se conceden y casi nunca se retiran. Sin una revisión con fecha, el alcance de
cada persona solo crece.

- Informe trimestral: personas con acceso a más de N cuentas, asignaciones directas de más
  de 90 días, excepciones de permiso sin motivo escrito.
- Aviso al responsable con la lista a confirmar o retirar.
- Registrar la revisión en auditoría, aunque no cambie nada: la constancia de que se revisó
  es parte del control.

**Terminado cuando** el primer informe trimestral llega solo.

---

## Fuera de alcance por ahora

Decisiones tomadas, anotadas para no rediscutirlas cada vez que aparezcan:

- **Eliminar `organization_id` del modelo.** Obliga a reescribir 1.233 sitios de código y
  rehacer 78 índices sin resolver ningún problema de seguridad. El comportamiento
  multi-empresa ya se eliminó; la columna queda como constante de la instalación. Si algún
  día aparece una segunda razón social, está disponible.
- **Permisos por cargo en base de datos.** Qué puede hacer un community manager es una
  definición de producto que se revisa en un cambio de código. Moverlo a base de datos lo
  vuelve un dato que nadie audita.
- **Portal de cliente ampliado.** Depende de que Meta apruebe `ads_read`. El interruptor
  `clientMetricsPanel` ya existe: el día que se apruebe, se enciende sin desplegar.

---

## Orden sugerido

```
I-0  ███  inmediato       sin código, protege más que todo lo demás junto
I-2  ███  4-6 semanas     el riesgo abierto más grave
I-4  ██   4-6 semanas     deja de descubrir fallos por reclamo del cliente
I-5  ██   6-8 semanas     cierra la última omisión posible del alcance
I-6  ██   6-8 semanas     hace usable lo que ya funciona
I-1  █    tras un ciclo   deuda, no riesgo
I-3  █    trimestre       mejora sobre un control que ya existe
I-7  █    trimestre       sostiene lo construido en el tiempo
```
