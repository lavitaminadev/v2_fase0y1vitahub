# Cómo usar el seguimiento de VitaHub

## La idea en una frase

Una sola planilla en Drive, con tres pestañas. Una es tuya, una es compartida
con Nico, y una explica las reglas.

| Pestaña | Quién llena | Quién lee |
| --- | --- | --- |
| **Mi día** | Solo tú | Solo tú |
| **Observaciones** | Nico el bloque izquierdo, tú el derecho | Los dos |
| **Instrucciones** | Nadie, es referencia | Los dos |

Las dos tablas no se pueden unir en una: la tuya es **una fila por tarea** y la
de Nico es **una fila por observación**. Son unidades distintas.

---

## Pestaña 1 — Mi día

Archivo: `SEGUIMIENTO-DIARIO.csv` · Ejemplo cargado: `SEGUIMIENTO-EJEMPLO.csv`

**Todas las columnas son tuyas.** Nico no escribe nada acá.

Una fila por tarea. Un día normal tiene entre 4 y 8 filas.

| Columna | Qué va | Valores |
| --- | --- | --- |
| Fecha | `2026-07-24` | Año-mes-día |
| Hora inicio / fin | `09:00` / `10:30` | |
| Horas estimadas | Lo calculado **antes** de partir | Con punto: `1.5` |
| Horas reales | Lo que tomó | |
| Excede | Si las reales superan las estimadas | Si · No |
| Motivo del exceso | Por qué tomó más | Obligatorio si `Excede` = `Si` |
| Medios utilizados | Herramientas de la tarea | VS Code · Claude Code · MariaDB local · Postman · DevTools · Meta Events Manager |
| Modulo | | Reservas · CRM · Meta/Pixel · Auth · General |
| Submodulo | | Formulario publico · Bandeja interna · Contactos · Conversions API |
| Tipo | | Bug · Implementacion · Ajuste · Prueba · Documentacion |
| Prioridad | | Alta · Media · Baja |
| Titulo | Una línea corta | |
| Detalle | Qué hiciste técnicamente | |
| Estado | | Pendiente · En progreso · Resuelto · Bloqueado |
| Bloqueo | Qué te frenó | Vacío si nada |
| Rama / Commit | Para trazar el cambio | |
| Validado con Nico | Si ya lo revisaron juntos | Si · No |
| Proximo paso | Qué sigue | |

**Las tres columnas que hacen la diferencia:**

- `Bloqueo` — un atraso con la causa anotada el día que ocurrió es un hecho. El
  mismo atraso explicado una semana después suena a excusa.
- `Excede` + `Motivo` — la estimación se anota *antes* de empezar. Si la pones al
  final siempre calza y la columna no mide nada. En un mes, los motivos
  repetidos te muestran dónde subestimas, y con eso estimas mejor la Fase 2.
- `Validado con Nico` — es la que evita que se repita lo de las veces anteriores.

---

## Pestaña 2 — Observaciones

Archivo: `OBSERVACIONES.csv`

Acá está la división. El encabezado de cada columna dice de quién es:

```
NICO · ...   →  lo llena Nico
YO · ...     →  lo llenas tú
```

En medio hay una columna separadora (`>>>`) que marca visualmente el corte.

### Bloque izquierdo — lo llena Nico

Solo seis campos, a propósito. Si le pides quince, no la usa.

| Columna | Qué va | Valores |
| --- | --- | --- |
| NICO · Fecha | Cuándo lo plantea | |
| NICO · Tipo | | Observacion · Reclamo · Error critico · Critica · Cambio solicitado |
| NICO · Severidad | | Alta · Media · Baja |
| NICO · Titulo | Una línea | |
| NICO · Detalle | Qué pasa, en sus palabras | |
| NICO · Lo necesito para | Fecha en que lo necesita | Puede ir vacío |

### Bloque derecho — lo llenas tú

| Columna | Qué va | Valores |
| --- | --- | --- |
| YO · ID | `OBS-001` | Correlativo, no se reutiliza |
| YO · Modulo / Submodulo | Dónde aplica | |
| YO · Canal | Cómo llegó | Reunion · Correo · WhatsApp · Llamada |
| YO · Estado | | Recibida · Aceptada · En correccion · Resuelta · En discusion |
| YO · Compromiso | La fecha que **tú** te comprometes | Puede diferir de la que él pidió |
| YO · Fecha resuelto | Cuándo se cerró | |
| YO · Que se hizo | La respuesta concreta | |
| YO · Ref seguimiento | Fila de `Mi día` relacionada | |

**Por qué hay dos fechas:** `NICO · Lo necesito para` es lo que él pide.
`YO · Compromiso` es lo que tú te compromete a cumplir. Cuando no coinciden,
queda registrado que se conversó y no que se ignoró.

### Reglas

- Se anota el mismo día, incluso lo que incomode. Una observación registrada y
  resuelta juega a tu favor; una que no aparece y reaparece en dos semanas juega
  en contra.
- `YO · Que se hizo` no se deja vacío cuando el estado pasa a `Resuelta`. Es la
  columna que convierte un reclamo en evidencia de que lo resolviste.
- `En discusion` existe para lo que no aceptaste. Si todo entra como `Aceptada`,
  la tabla deja de ser un registro y pasa a ser una lista de culpas.
- Un `Cambio solicitado` que amplía el alcance se registra, se estima y se
  acuerda **antes** de implementarlo.

---

## Rutina

| Cuándo | Qué |
| --- | --- |
| Al cerrar el día | Cargar las filas del día en `Mi día` |
| En cada reunión | Las observaciones nuevas entran a `Observaciones` con fecha |
| Cada semana | Repasar observaciones abiertas, actualizar estados, resumir avance |

---

## Montaje en Drive

1. Subir los tres archivos a `04 Seguimiento diario`.
2. Abrir cada uno con Hojas de cálculo (click derecho → Abrir con).
3. Dejarlos como pestañas de **una sola planilla**, llamada
   `VitaHub — Seguimiento`, con las pestañas `Mi día`, `Observaciones` e
   `Instrucciones`.
4. Inmovilizar la fila 1 en las dos pestañas de datos
   (Ver → Inmovilizar → 1 fila).
5. Pintar de un color el bloque `NICO ·` y de otro el bloque `YO ·` en
   Observaciones. Es lo que hace que se entienda sin leer nada.
6. Poner desplegables en `Tipo`, `Severidad`, `Modulo`, `Prioridad` y `Estado`
   (Datos → Validación de datos), con los valores de las tablas de arriba.
7. Proteger el bloque `YO ·` para que solo tú lo edites
   (Datos → Proteger hojas y rangos).

Sin el paso 6 aparecen diez formas de escribir lo mismo y se pierde el filtrado.
Sin el 7, cualquiera puede cambiar un estado sin que quede rastro.

**Nota:** si editas un CSV a mano, una coma dentro de una celda rompe el archivo.
Hay que encerrar ese texto en comillas. Una vez en Sheets, deja de ser problema.

---

## Qué se comparte y qué no

Criterio definido para este proyecto:

| Qué | Compartir con Nico |
| --- | --- |
| Pestaña `Observaciones` | Sí, con permiso de edición |
| Pestaña `Instrucciones` | Sí, solo lectura |
| Resumen semanal de avance | Sí |
| Pestaña `Mi día` | No de entrada. Disponible si la pide |

El detalle diario con horas es una herramienta de trabajo, no un entregable.
Abrir el registro hora por hora traslada la conversación al tiempo invertido en
vez de a lo entregado, y mientras el precio del proyecto no esté cerrado, fija
la negociación en horas en vez de en alcance.

Las columnas `Horas estimadas`, `Horas reales`, `Excede` y `Motivo del exceso`
existen para medir y corregir tus propias estimaciones. No son material de
reporte al cliente.

**Detalle práctico:** si las tres pestañas viven en la misma planilla, compartir
una comparte todas. Para mantener `Mi día` fuera, hay dos opciones: ocultar la
pestaña y protegerla, o dejar `Mi día` en una planilla aparte. La segunda es más
segura — una pestaña oculta se muestra con dos clics.
