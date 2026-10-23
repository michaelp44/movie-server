import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { appRoot, repositoryRoot } from './locations.js';

loadEnv({ path: join(repositoryRoot, '.env') });
loadEnv({ path: join(appRoot, '.env'), override: true });
