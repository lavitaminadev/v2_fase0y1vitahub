import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Vínculo directo entre reserva y contacto de campañas.
 *
 * El brief de Fase 1 define la relación «un contacto tiene muchas reservas» como parte del
 * modelo objetivo, y las vistas de ficha de contacto dependen de poder listar sus reservas.
 * Hasta ahora esa relación era implícita: había que cruzar teléfono o correo contra el lead que
 * originó el contacto. Además de costoso, ese cruce falla apenas alguien corrige un teléfono
 * mal escrito, porque la reserva y el contacto dejan de coincidir.
 *
 * La columna es nullable: una reserva puede existir sin contacto cuando el cliente tiene el CRM
 * desactivado.
 *
 * El relleno histórico une reserva → lead → contacto dentro del mismo cliente. Es parcial por
 * diseño: los teléfonos se guardan normalizados en el lead y tal como se escribieron en la
 * reserva, así que solo empareja donde ambos coinciden. No se fuerza nada dudoso; una reserva
 * sin contacto es un dato faltante honesto y recuperable, un vínculo equivocado no.
 */
export class ReservationContactLink1724164200000 implements MigrationInterface {
  name = 'ReservationContactLink1724164200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('reservations', 'contact_id'))) {
      await queryRunner.addColumn('reservations', new TableColumn({
        name: 'contact_id',
        type: 'char',
        length: '36',
        isNullable: true,
      }));
    }

    // Coincidencia exacta por identificador externo: es la más segura, porque la captura escribe
    // `reservation:{id}` al crear el lead. Solo alcanza a la última reserva de cada contacto,
    // ya que el valor se sobreescribe cuando el lead se reutiliza.
    await queryRunner.query(`
      UPDATE reservations r
      INNER JOIN crm_leads l ON l.external_lead_id = CONCAT('reservation:', r.id)
      INNER JOIN crm_contacts c ON c.lead_id = l.id
      SET r.contact_id = c.id
      WHERE r.contact_id IS NULL
    `);

    // Resto de las reservas: se emparejan por teléfono o correo dentro del mismo cliente.
    await queryRunner.query(`
      UPDATE reservations r
      INNER JOIN crm_leads l
        ON l.client_id = r.client_id
       AND l.source = 'vitahub_reservations'
       AND (
             (l.phone IS NOT NULL AND r.guest_phone IS NOT NULL AND l.phone = r.guest_phone)
          OR (l.email IS NOT NULL AND r.guest_email IS NOT NULL AND l.email = r.guest_email)
           )
      INNER JOIN crm_contacts c ON c.lead_id = l.id
      SET r.contact_id = c.id
      WHERE r.contact_id IS NULL
    `);

    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reservations' AND index_name = 'IDX_reservations_contact'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) === 0) {
      await queryRunner.query('CREATE INDEX IDX_reservations_contact ON reservations (contact_id)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexExists = await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reservations' AND index_name = 'IDX_reservations_contact'`,
    );
    if (Number(indexExists?.[0]?.total ?? 0) > 0) {
      await queryRunner.query('DROP INDEX IDX_reservations_contact ON reservations');
    }

    if (await queryRunner.hasColumn('reservations', 'contact_id')) {
      await queryRunner.dropColumn('reservations', 'contact_id');
    }
  }
}
