# CRM

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-28`
FUENTE: brief de Fase 1, codigo actual de `apps/api` y `apps/web`

## Rol Del CRM En Fase 1

En Fase 1 el CRM no se presenta como pipeline comercial completo. Su rol correcto
es servir como **registro operacional de contactos conectados a reservas y campanas**.

La unidad principal no es la oportunidad comercial de La Vitamina, sino la persona
que llega desde una campana, reserva, asiste o no asiste, y debe quedar trazable
por cliente para alimentar operacion y conversiones Meta.

## Reencuadre Funcional

- Se reutiliza la base CRM existente para no partir de cero.
- Se desacopla el discurso de "pipeline comercial" del entregable Fase 1.
- La vista principal de Fase 1 pasa a ser `Contactos de campanas`.
- La reserva pasa a ser la fuente de verdad operacional.
- El estado del contacto pasa a ser un resumen visible derivado de la reserva.

## Lo Que Se Reutiliza

- Entidad principal existente: `Lead`
- Servicio de ingreso existente: `LeadIntakeService.captureLead()`
- Dedupe actual por `externalLeadId`, `email` y `phone`
- Trazabilidad existente de fuente, campana, formulario y metadata
- Endpoints CRM ya disponibles para lectura y actualizacion

Esto permite construir Fase 1 sobre una base real, pero con una experiencia
funcional mas simple y mejor alineada al brief.

## Ajuste De Modelo Para Fase 1

### Contacto Operacional

Para Fase 1 el contacto debe representar:

- cliente al que pertenece
- nombre
- telefono normalizado
- email normalizado
- origen y campana
- estado resumen
- ultima actividad
- reserva mas reciente

### Estado Resumen Recomendado

- `nuevo`
- `reservo`
- `asistio`
- `no_asistio`

Regla recomendada:

- la reserva conserva su propio estado completo;
- el contacto solo expone un resumen simple para filtrar y operar.

## Conexion Correcta Con Reservas

El CRM de Fase 1 debe quedar conectado a reservas asi:

1. entra una reserva publica o externa;
2. se identifica `organizationId` y `clientId`;
3. se busca contacto existente dentro de ese cliente;
4. si existe, se actualiza la ultima actividad y se vincula la nueva reserva;
5. si no existe, se crea el contacto operacional;
6. al marcar asistencia o no asistencia, se actualiza el estado resumen;
7. la reserva mantiene su historial propio y Meta usa la trazabilidad de esa reserva.

## Lo Que No Debe Liderar La Experiencia

Aunque el codigo tenga modulos de oportunidades, contactos comerciales e interacciones,
eso no debe quedar como centro de Fase 1.

Para presentacion y uso real de Fase 1:

- no venderlo como pipeline comercial;
- no exigir etapas de negocio para operar reservas;
- no mezclar contactos de clientes con prospectos de agencia;
- no expandir automatizaciones, scoring ni secuencias.

## Vista Recomendada Para Fase 1

La experiencia CRM de esta fase debe organizarse como:

### Vista principal

`Contactos de campanas`

Campos visibles:

- nombre
- telefono
- email
- cliente
- origen
- campana
- estado resumen
- numero de reservas
- ultima actividad

Acciones:

- filtrar por cliente
- filtrar por estado
- buscar
- abrir ficha
- ver reservas asociadas
- cambiar estado manual cuando sea necesario

### Ficha del contacto

Debe priorizar:

- datos basicos
- cliente asociado
- origen/campana
- historial cronologico
- reservas asociadas
- ultimo resultado operacional

## Intake Externo: Formularios Ajenos A VitaHub

Para no obligar a que toda captura ocurra solo en la pagina publica de VitaHub,
Fase 1 debe dejar definido un modulo de ingreso externo controlado.

### Objetivo

Permitir que un formulario externo tambien pueda crear o actualizar un contacto
operacional y, cuando aplique, una reserva, sin romper el aislamiento por cliente.

### Forma recomendada

Crear un modulo de **intake externo** con dos entradas compatibles:

1. un endpoint autenticado para integraciones;
2. una bandeja o carpeta de importacion para cargas manuales estructuradas.

### Endpoint sugerido

`POST /crm/intake/external`

Payload minimo sugerido:

```json
{
  "organizationId": "uuid",
  "clientId": "uuid",
  "source": "external_form",
  "externalFormId": "landing-meta-01",
  "externalSubmissionId": "abc-123",
  "contact": {
    "name": "Daniela Soto",
    "phone": "+56955552001",
    "email": "daniela@example.com"
  },
  "reservation": {
    "requestedDate": "2026-08-02",
    "requestedTime": "20:00",
    "partySize": 2
  },
  "attribution": {
    "utmSource": "instagram",
    "utmCampaign": "invierno-casa-nativa",
    "fbclid": "..."
  },
  "metadata": {}
}
```

### Reglas del modulo

- siempre exigir `organizationId` y `clientId`
- deduplicar por `externalSubmissionId` y contacto normalizado
- permitir contacto sin reserva solo si se declara explicitamente
- registrar trazabilidad de origen externo
- no mezclar formularios externos con pipeline comercial de agencia
- dejar la conversion Meta subordinada a la existencia de una reserva valida

### Opcion de archivo

Si se requiere operacion manual, dejar tambien una carpeta o formato estandar
de importacion CSV/JSON con las mismas claves funcionales del endpoint para
ingresar datos al mismo flujo de intake.

## Decision Recomendada Sobre El Modelo

La recomendacion mas segura para presentar hoy es:

- reutilizar `Lead` como base tecnica actual;
- renombrar funcionalmente la experiencia a `Contactos de campanas`;
- conectar su estado y uso diario a reservas;
- dejar oportunidades/interacciones fuera del centro de Fase 1;
- preparar el modulo `crm/intake/external` como punto de extension para formularios externos.

## Estado De Veracidad Frente A Fase 1

- Es verdadero que existe una base CRM real reutilizable.
- Es verdadero que hoy el relato del modulo esta mas cerca de pipeline comercial que de CRM operacional de reservas.
- El ajuste necesario ahora es principalmente de enfoque funcional, vistas y conexion con reservas, no de reconstruccion completa.
