import { describe, expect, it, vi } from 'vitest';
import { MAX_IMPORT_ROWS, ReservationsBulkImportService } from '../../../src/modules/reservations/application/bulk-import.service';

const FORM_ID = '11111111-1111-1111-1111-111111111111';

function makeService(createManual = vi.fn().mockResolvedValue({ id: 'res-1' })) {
  const reservations = { createManual } as any;
  return { service: new ReservationsBulkImportService(reservations), createManual };
}

const header = 'nombre,email,telefono,fecha,personas\n';

describe('ReservationsBulkImportService.parse', () => {
  it('mapea cabeceras en espanol e ingles', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana Perez,ana@test.com,912345678,2026-08-01T10:00:00Z,2`, FORM_ID);
    expect(preview.totalRows).toBe(1);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0].data).toMatchObject({
      formId: FORM_ID,
      guestName: 'Ana Perez',
      guestEmail: 'ana@test.com',
      guestPhone: '912345678',
      partySize: 2,
    });
  });

  it('acepta cabeceras con acentos y mayusculas', () => {
    const { service } = makeService();
    const preview = service.parse('Nombre,Teléfono,Fecha\nAna,912345678,2026-08-01T10:00:00Z', FORM_ID);
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].data.guestPhone).toBe('912345678');
  });

  it('exige nombre', () => {
    const { service } = makeService();
    const preview = service.parse(`${header},ana@test.com,,2026-08-01T10:00:00Z,`, FORM_ID);
    expect(preview.rows[0].errors).toContain('Falta el nombre');
    expect(preview.validRows).toBe(0);
  });

  it('exige email o telefono', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana,,,2026-08-01T10:00:00Z,`, FORM_ID);
    expect(preview.rows[0].errors).toContain('Se requiere email o telefono'.replace('telefono', 'teléfono'));
  });

  it('acepta solo telefono, sin email', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana,,912345678,2026-08-01T10:00:00Z,`, FORM_ID);
    expect(preview.rows[0].errors).toEqual([]);
  });

  it('rechaza email malformado', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana,no-es-email,,2026-08-01T10:00:00Z,`, FORM_ID);
    expect(preview.rows[0].errors).toContain('Email inválido');
  });

  it('rechaza fecha invalida e informa el valor', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana,ana@test.com,,no-es-fecha,`, FORM_ID);
    expect(preview.rows[0].errors[0]).toMatch(/Fecha inválida: "no-es-fecha"/);
  });

  it('rechaza cantidad de personas fuera de rango', () => {
    const { service } = makeService();
    const preview = service.parse(`${header}Ana,ana@test.com,,2026-08-01T10:00:00Z,0`, FORM_ID);
    expect(preview.rows[0].errors[0]).toMatch(/Cantidad de personas inválida/);
  });

  it('numera las filas sin contar la cabecera', () => {
    const { service } = makeService();
    const preview = service.parse(
      `${header}Ana,ana@test.com,,2026-08-01T10:00:00Z,\nBeto,beto@test.com,,2026-08-02T10:00:00Z,`,
      FORM_ID,
    );
    expect(preview.rows.map((row) => row.rowNumber)).toEqual([1, 2]);
  });

  it('rechaza archivos sin filas de datos', () => {
    const { service } = makeService();
    expect(() => service.parse(header, FORM_ID)).toThrow(/no tiene filas de datos/);
  });

  it('rechaza archivos que superan el tope de filas', () => {
    const { service } = makeService();
    const rows = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, i) => `Ana ${i},ana${i}@test.com,,2026-08-01T10:00:00Z,`,
    ).join('\n');
    expect(() => service.parse(`${header}${rows}`, FORM_ID)).toThrow(/supera el máximo de 500 filas/);
  });
});

describe('ReservationsBulkImportService.import', () => {
  it('crea solo las filas validas y reporta las demas', async () => {
    const { service, createManual } = makeService();
    const csv = `${header}Ana,ana@test.com,,2026-08-01T10:00:00Z,\n,sin-nombre@test.com,,2026-08-02T10:00:00Z,`;
    const result = await service.import('org-1', 'user-1', csv, FORM_ID);

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatchObject({ rowNumber: 2 });
    expect(createManual).toHaveBeenCalledOnce();
  });

  it('propaga el scope y skipAvailability a createManual', async () => {
    const { service, createManual } = makeService();
    const csv = `${header}Ana,ana@test.com,,2026-08-01T10:00:00Z,`;
    await service.import('org-1', 'user-1', csv, FORM_ID, {
      skipAvailability: true, clientId: 'client-1', clientIds: ['client-1'],
    });

    const [organizationId, userId, dto, clientId, clientIds] = createManual.mock.calls[0];
    expect(organizationId).toBe('org-1');
    expect(userId).toBe('user-1');
    expect(dto.skipAvailability).toBe(true);
    expect(clientId).toBe('client-1');
    expect(clientIds).toEqual(['client-1']);
  });

  it('una fila que falla al crear no detiene el resto', async () => {
    const createManual = vi.fn()
      .mockRejectedValueOnce(new Error('Horario no disponible'))
      .mockResolvedValueOnce({ id: 'res-2' });
    const { service } = makeService(createManual);
    const csv = `${header}Ana,ana@test.com,,2026-08-01T10:00:00Z,\nBeto,beto@test.com,,2026-08-02T10:00:00Z,`;

    const result = await service.import('org-1', 'user-1', csv, FORM_ID);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toEqual({ rowNumber: 1, message: 'Horario no disponible' });
  });
});
