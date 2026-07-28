import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Protección de la cuenta frente a fuerza bruta y trazabilidad del primer ingreso.
 *
 * - `failed_login_attempts` / `locked_until`: el límite por IP no frena un ataque repartido
 *   entre muchas direcciones contra una misma cuenta; el contador vive en la cuenta.
 * - `last_login_at`: permite que el titular reconozca actividad que no hizo.
 * - `terms_accepted_at` / `terms_version`: la aceptación se marcaba solo en la interfaz y
 *   no quedaba registrada en ninguna parte, así que no había forma de demostrarla.
 * - `must_complete_profile`: el alta la crea administración con lo mínimo, y cada persona
 *   completa sus propios datos al entrar.
 *
 * Las columnas se agregan solo si faltan, para poder reejecutar tras una interrupción.
 */
export class AccountSecurityAndOnboarding1724165000000 implements MigrationInterface {
  name = 'AccountSecurityAndOnboarding1724165000000';

  private readonly columns: TableColumn[] = [
    new TableColumn({ name: 'failed_login_attempts', type: 'smallint', isNullable: false, default: 0 }),
    new TableColumn({ name: 'locked_until', type: 'timestamp', isNullable: true }),
    new TableColumn({ name: 'last_login_at', type: 'timestamp', isNullable: true }),
    new TableColumn({ name: 'terms_accepted_at', type: 'timestamp', isNullable: true }),
    new TableColumn({ name: 'terms_version', type: 'varchar', length: '20', isNullable: true }),
    new TableColumn({ name: 'must_complete_profile', type: 'boolean', isNullable: false, default: false }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.columns) {
      if (!(await queryRunner.hasColumn('users', column.name))) {
        await queryRunner.addColumn('users', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.columns) {
      if (await queryRunner.hasColumn('users', column.name)) {
        await queryRunner.dropColumn('users', column.name);
      }
    }
  }
}
