import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(appRoot, '../..');
