import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../../src/core/auth/decorators/public.decorator';
import { MetaController } from '../../../src/modules/integrations/meta/meta.controller';

describe('Meta webhook access boundary', () => {
  it('deja pasar las llamadas de Meta sin autenticar, para verificarlas por firma', () => {
    // La organizacion de destino no puede venir de la peticion: el webhook la resuelve por
    // los datos que Meta envia firmados.
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MetaController)).toBe(true);
  });
});
