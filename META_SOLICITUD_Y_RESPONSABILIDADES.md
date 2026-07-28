# VITAHUB — Solicitud a Meta: qué está listo, qué es tu responsabilidad y cómo presentarlo

**Para:** Nico
**Estado del código:** verificado sobre la rama actual
**Qué es esto:** el reparto de responsabilidades para la solicitud ante Meta, los casos de uso redactados para pegar en el formulario, y el orden en que conviene presentarlo.

---

## 0. Lo primero: hay dos caminos, y solo uno está bloqueado

Esta distinción decide el calendario y conviene tenerla clara antes de abrir nada en Meta.

| Camino | Qué permite | ¿Requiere App Review? | Estado |
|---|---|:--:|---|
| **Conversions API (CAPI)** | Enviar a Meta quién reservó y quién asistió | **No** | ✅ Construido y funcionando |
| **Lectura de métricas (`ads_read`)** | Panel de resultados del cliente (Fase 2) | **Sí** + Business Verification | ⏸ Construido, esperando aprobación |

**Consecuencia práctica:** el circuito de conversión —el dolor #1— puede operar **hoy**, sin esperar a Meta. Lo único que se necesita es que cada cliente comparta su Pixel y genere un token. Eso es onboarding por cuenta, no un trámite de aprobación.

El App Review solo bloquea el panel de la Fase 2. Por eso se envía de fondo ahora, para que no aparezca como sorpresa dentro de dos meses.

---

## 1. ⚠️ Antes de enviar nada: hay que recortar los permisos

**Este es el punto más importante del documento.**

El código está pidiendo **nueve permisos** en el flujo de autorización:

```
ads_read                      ← el único que el alcance justifica
leads_retrieval
pages_show_list
instagram_basic
instagram_manage_messages
pages_messaging
pages_manage_metadata
pages_read_engagement
business_management
```

*(`apps/api/src/modules/integrations/meta/meta-oauth.service.ts`, método `getAuthorizationScopes`)*

**Por qué importa:** Meta revisa **cada permiso por separado**. Cada uno exige su propio caso de uso escrito, su propio video de demostración y su propia justificación. Pedir permisos que la aplicación no usa es la causa número uno de rechazo y de rondas de ida y vuelta que suman semanas.

Además, esto contradice la decisión que ya tomaste: *"Escribir/optimizar campañas desde VitaHub (`ads_management`): NO por ahora"*. La lista actual va mucho más allá de eso — incluye mensajería de Instagram y gestión de páginas, que no aparecen en ningún caso de uso del alcance.

**Mi recomendación:** enviar la solicitud pidiendo **solo `ads_read`** (y `business_management` únicamente si el equipo de Meta lo exige para acceder a las cuentas publicitarias del negocio). Los demás se piden más adelante, en una solicitud aparte, si algún día se usan.

**Esto es una decisión tuya, no mía.** Si confirmas, dejo el recorte hecho en una línea. Si algún permiso responde a una funcionalidad que sí planeas usar, dímelo y lo mantenemos con su caso de uso redactado.

---

## 2. Reparto de responsabilidades

### Es tuyo (Nico / La Vitamina)

Nada de esto lo puede hacer el desarrollo. Son decisiones de negocio o trámites que exigen identidad verificable de la empresa.

| # | Responsabilidad | Por qué es tuya | Bloquea a |
|---|---|---|---|
| 1 | **Business Verification** en Business Manager | Exige documentos legales de La Vitamina | Todo el App Review |
| 2 | **Enviar el App Review de `ads_read`** | Se envía desde la cuenta de negocio | Fase 2 |
| 3 | **Decidir el recorte de permisos** (§1) | Define qué hace el producto | Que el envío no se rechace |
| 4 | **Publicar Política de Privacidad y Términos** en el dominio | Requisito obligatorio de Meta. Hoy **no existe** | El envío no se puede completar sin URL |
| 5 | **Dominio + HTTPS productivo** | Contratación e infraestructura | Página pública y CAPI reales |
| 6 | **Que cada cliente comparta su Pixel** y genere token | Es del negocio del cliente, no nuestro | Conversiones de esa cuenta |
| 7 | **Cambiar el enlace de los anuncios** a la página de VitaHub | Está en tus campañas | Sin esto **no hay match posible** |
| 8 | **Grabar el video de demostración** | Debe mostrarte operando el producto | El App Review |

> **Sobre el punto 7:** vale la pena repetirlo porque es el que más silenciosamente arruina el proyecto. Si los anuncios siguen apuntando al Google Form, el circuito completo queda construido y **sin un solo dato**. No hay forma de detectarlo desde el código.

> **Sobre el punto 4:** la página pública de reserva pide nombre, teléfono y correo, y captura identificadores de Meta. Hoy tiene una casilla de consentimiento configurable por formulario, pero **no hay una página de Política de Privacidad publicada**. Meta la exige como URL en el formulario de revisión. Es el bloqueo más barato de resolver y el que más gente olvida.

### Es mío (desarrollo)

| Estado | Elemento |
|:--:|---|
| ✅ | Página pública de reserva con Pixel del cliente |
| ✅ | Captura de `fbclid`, `_fbp`, `_fbc`, IP y user agent |
| ✅ | Evento `Schedule` al reservar |
| ✅ | Evento `Reserva_Asistida` al marcar asistencia |
| ✅ | Hash SHA-256 de correo, teléfono y nombre antes de enviar |
| ✅ | `eventId` estable por evento, para que Meta deduplique |
| ✅ | Token de servidor cifrado, nunca expuesto al navegador |
| ✅ | Cola de envío con reintentos y corte a los 7 días |
| ✅ | Estado de conversión visible por reserva en la bandeja |
| ✅ | Callback de eliminación de datos con verificación de firma |
| ✅ | Anonimización de datos personales y registro en bitácora |
| ✅ | Panel de Fase 2 construido tras un interruptor de función |
| ⏸ | Encender la Fase 2 — un valor a `true` el día que Meta apruebe |

---

## 3. Casos de uso, listos para pegar

Meta pide, por cada permiso, que expliques **qué haces con el dato, por qué lo necesitas y qué ve el usuario**. Estos textos están redactados en ese formato.

### 3.1 `ads_read` — el único que hay que defender

> **Qué hace la aplicación con este permiso**
>
> VITAHUB es la plataforma interna de una agencia de marketing que administra campañas para sus clientes, principalmente restaurantes. Usamos `ads_read` exclusivamente para **leer, en modo solo lectura, las métricas de las campañas de cada cliente** (inversión, alcance, resultados) y cruzarlas con las reservas que esa misma campaña generó en nuestra plataforma.
>
> El resultado se muestra en un panel de consulta dentro del portal privado del cliente, donde el cliente ve únicamente los datos de su propia cuenta publicitaria.
>
> **Por qué lo necesitamos**
>
> Sin este permiso, el cliente ve cuántas personas reservaron y asistieron, pero no cuánto costó conseguirlas. El panel existe para responder una sola pregunta: *cuánto se invirtió y cuántas personas terminaron entrando al local*. Esa lectura no puede obtenerse de ninguna otra forma.
>
> **Qué NO hacemos**
>
> No creamos, modificamos, pausamos ni optimizamos campañas. No solicitamos `ads_management`. La optimización la realiza el equipo manualmente en Ads Manager, mirando este panel. El acceso es estrictamente de lectura.
>
> **Quién accede al dato**
>
> El equipo de la agencia, y cada cliente restringido a su propia cuenta. Los datos no se comparten con terceros ni se usan para publicidad propia.

### 3.2 Conversions API — no requiere revisión, pero conviene documentarlo

> Enviamos dos eventos de conversión por reserva, desde servidor:
>
> 1. **`Schedule`** — cuando el comensal completa una reserva en la página pública alojada en nuestro dominio.
> 2. **`Reserva_Asistida`** — cuando el personal del restaurante confirma que la persona efectivamente asistió.
>
> Los datos de coincidencia (correo y teléfono) se transmiten **hasheados con SHA-256** antes de salir del servidor. Se acompañan de `fbc` y `fbp` capturados por el Pixel en la página, más IP y user agent. Cada evento lleva un identificador estable para permitir la deduplicación.
>
> El segundo evento es el valioso: distingue a quien reservó y **efectivamente fue** de quien solo hizo clic, permitiendo que la campaña optimice hacia clientes reales.

### 3.3 Si mantienes los otros permisos

Cada uno necesitará su propio bloque con la misma estructura: qué hace, por qué es imprescindible, qué ve el usuario y un video que lo demuestre **en funcionamiento**. Si la funcionalidad no existe todavía en el producto, Meta lo rechaza. Es la razón principal por la que recomiendo recortar (§1).

---

## 4. El video de demostración

Meta rechaza más solicitudes por un video pobre que por el texto. Debe mostrar el **producto real funcionando**, no diapositivas.

**Guion sugerido, entre 2 y 3 minutos:**

1. Inicias sesión en VITAHUB con una cuenta real
2. Vas a **Integraciones** y muestras la conexión con Meta de un cliente
3. Abres **Reservas** y muestras un formulario publicado con su Pixel asignado
4. Abres el enlace público **desde un teléfono** y completas una reserva de prueba
5. Vuelves a la bandeja: aparece la reserva nueva con su indicador de conversión
6. Marcas **Asistió** en un clic
7. **Muestras el panel de Fase 2** con las métricas leídas vía `ads_read` — *este es el paso que justifica el permiso, no puede faltar*
8. Cierras mostrando que el cliente, desde su portal, solo ve su propia cuenta

**Detalles que importan:** narración o subtítulos en inglés, sin cortes que oculten pasos, y con datos visibles (aunque sean de prueba, deben parecer reales).

---

## 5. Orden en que conviene presentarlo

Este orden minimiza el tiempo total, porque arranca lo lento primero.

| Momento | Acción | Responsable |
|---|---|---|
| **Ahora** | Publicar Política de Privacidad y Términos en el dominio | Nico |
| **Ahora** | Iniciar **Business Verification** (es lo más lento) | Nico |
| **Ahora** | Confirmar el recorte de permisos | Nico decide, yo ejecuto |
| **Esta semana** | Dominio + HTTPS productivo | Nico / hosting |
| **Al tener HTTPS** | Conectar el Pixel del primer cliente y hacer una reserva de prueba | Equipo |
| **Al tener HTTPS** | **Cambiar el enlace de los anuncios** a la página de VitaHub | Nico |
| **Con Verification aprobada** | Grabar el video con el flujo completo | Nico + equipo |
| **Después del video** | Enviar App Review de `ads_read` | Nico |
| **Al aprobar** | Encender la Fase 2 (un interruptor) | Yo |

**El circuito de conversión no espera a ninguno de estos pasos salvo el dominio HTTPS y el cambio de enlace en los anuncios.** Esos dos son los que realmente frenan el dolor #1.

---

## 6. Riesgos, ordenados por probabilidad

| Riesgo | Impacto | Cómo se evita |
|---|---|---|
| **Los anuncios siguen apuntando al Google Form** | Circuito completo, cero datos. Silencioso | Cambiar el enlace el mismo día que HTTPS esté listo |
| **Rechazo por pedir permisos sin usar** | Semanas de ida y vuelta | Recortar a `ads_read` antes de enviar (§1) |
| **No hay Política de Privacidad publicada** | No se puede completar el envío | Publicarla ya; es lo más barato de la lista |
| **Business Verification se demora** | Fase 2 se corre entera | Iniciarla ahora, en paralelo a todo |
| **El cliente no comparte su Pixel** | Sin conversiones de esa cuenta | Incluirlo en el onboarding como paso obligatorio |
| **Video que no muestra el permiso en uso** | Rechazo casi seguro | El paso 7 del guion es innegociable |

---

## 7. Resumen en una línea

**Lo técnico de las conversiones está terminado y probado.** Lo que falta para Meta no es código: es Business Verification, una Política de Privacidad publicada, el dominio HTTPS, recortar los permisos a lo que realmente usamos, y cambiar el enlace de los anuncios.

De esos cinco, cuatro son tuyos. El quinto —el recorte de permisos— lo ejecuto yo en cuanto me confirmes el criterio.
