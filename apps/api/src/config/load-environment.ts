import { config } from 'dotenv';
import { resolve } from 'node:path';

// Tanto ts-node como el código compilado de Passenger viven cuatro niveles debajo de la raíz del repo.
config({ path: process.env.DOTENV_CONFIG_PATH || resolve(__dirname, '../../../../.env') });
