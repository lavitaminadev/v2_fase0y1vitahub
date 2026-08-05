import { MigrationInterface, QueryRunner } from 'typeorm';

const INDEX_NAME = 'UQ_form_events_form_type_session';

/**
 * Idempotencia real para los eventos del formulario público.
 *
 * La deduplicación era una consulta previa seguida de un `save`, sin transacción ni
 * restricción que la respaldara: entre ambas cabe otra petición. A diferencia de las
 * reservas —que se serializan por el bloqueo sobre la fila del formulario— acá no había
 * nada, así que un doble clic o un reintento del navegador creaba dos respuestas de
 * encuesta. Y como la conversión a Meta se encola con `lead:<id de la respuesta>`, cada
 * duplicado generaba un evento `Lead` adicional en Events Manager.
 *
 * `session_id` admite nulos y MySQL permite repetirlos en un índice único, de modo que los
 * eventos sin sesión —los que no se deduplican— no se ven afectados.
 */
export class FormEventIdempotency1725900000000 implements MigrationInterface {
  name = 'FormEventIdempotency1725900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('reservation_form_events');
    if (!table) return;
    if (table.indices.some((index) => index.name === INDEX_NAME)) return;

    // Los duplicados que ya entraron por la carrera impedirían crear el índice. Se conserva
    // el primero de cada grupo, que es el que la aplicación venía devolviendo.
    await queryRunner.query(`
      DELETE e FROM \`reservation_form_events\` e
      JOIN (
        SELECT MIN(id) AS keep_id, form_id, type, session_id
        FROM \`reservation_form_events\`
        WHERE session_id IS NOT NULL
        GROUP BY form_id, type, session_id
        HAVING COUNT(*) > 1
      ) d ON e.form_id = d.form_id AND e.type = d.type AND e.session_id = d.session_id
      WHERE e.id <> d.keep_id
    `);

    await queryRunner.query(
      `ALTER TABLE \`reservation_form_events\` ADD UNIQUE KEY \`${INDEX_NAME}\` (\`form_id\`, \`type\`, \`session_id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('reservation_form_events');
    if (!table?.indices.some((index) => index.name === INDEX_NAME)) return;
    await queryRunner.query(`ALTER TABLE \`reservation_form_events\` DROP INDEX \`${INDEX_NAME}\``);
  }
}
