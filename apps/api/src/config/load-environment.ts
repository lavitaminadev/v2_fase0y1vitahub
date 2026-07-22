import { config } from 'dotenv';
import { resolve } from 'node:path';

// Both ts-node and compiled Passenger code live four levels below the repo root.
config({ path: process.env.DOTENV_CONFIG_PATH || resolve(__dirname, '../../../../.env') });
