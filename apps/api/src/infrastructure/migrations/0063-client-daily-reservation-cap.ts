import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Tope diario de reservas a nivel de cliente.
 *
 * El tope vivia solo en el formulario, de modo que un cliente con dos formularios activos
 * podia recibir el doble de lo que habia fijado. El brief define el tope como una decision
 * del cliente sobre su jornada, no sobre un formulario concreto.
 *
 * Se crea en 0 (sin limite) para no alterar el comportamiento de las cuentas existentes:
 * hasta que alguien fije un tope, manda el del formulario como hasta ahora.
 */
export class ClientDailyReservationCap1724164000000 implements MigrationInterface {
  name = 'ClientDailyReservationCap1724164000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('clients', 'daily_reservation_cap'))) {
      await queryRunner.addColumn('clients', new TableColumn({
        name: 'daily_reservation_cap',
        type: 'smallint',
        isNullable: false,
        default: 0,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('clients', 'daily_reservation_cap')) {
      await queryRunner.dropColumn('clients', 'daily_reservation_cap');
    }
  }
}
