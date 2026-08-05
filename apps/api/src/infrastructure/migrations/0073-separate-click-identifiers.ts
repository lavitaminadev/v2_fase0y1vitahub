import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Identificadores de clic separados por plataforma.
 *
 * Hasta ahora existía una sola columna `click_id` que el formulario público llenaba con
 * `gclid || fbclid`. Al encolar la conversión de Google se emitía tal cual en el campo
 * `gclid`, de modo que un clic venido de Meta viajaba a Google Ads como identificador de
 * Google: Google lo rechaza dentro de `partialFailureError` y la conversión se pierde sin
 * que nada falle de forma visible.
 *
 * Se añaden además `gbraid` y `wbraid`, que son los identificadores que Google entrega en
 * campañas iOS y de aplicación cuando no hay cookies. Sin ellos ese tráfico llega sin
 * ningún identificador de clic.
 *
 * `click_id` se conserva: guarda el histórico ya capturado y las versiones del formulario
 * que sigan en la caché del navegador continúan enviándolo.
 */
export class SeparateClickIdentifiers1725800000000 implements MigrationInterface {
  name = 'SeparateClickIdentifiers1725800000000';

  private static readonly COLUMNS = ['gclid', 'gbraid', 'wbraid', 'fbclid'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of SeparateClickIdentifiers1725800000000.COLUMNS) {
      if (await queryRunner.hasColumn('reservations', name)) continue;
      await queryRunner.addColumn('reservations', new TableColumn({
        name, type: 'varchar', length: '255', isNullable: true,
      }));
    }

    // El histórico se recupera solo para Google: `click_id` se emitía como `gclid`, así que
    // los valores que Google aceptó son los que ya estaban ahí. No se intenta repartir el
    // resto entre gclid y fbclid porque no hay forma fiable de distinguirlos a posteriori, y
    // adivinar mal ensucia la atribución en lugar de arreglarla.
    await queryRunner.query(
      'UPDATE `reservations` SET `gclid` = `click_id` WHERE `click_id` IS NOT NULL AND `gclid` IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [...SeparateClickIdentifiers1725800000000.COLUMNS].reverse()) {
      if (await queryRunner.hasColumn('reservations', name)) await queryRunner.dropColumn('reservations', name);
    }
  }
}
