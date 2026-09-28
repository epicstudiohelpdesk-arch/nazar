import { validateEnv } from '@platform/validation';
import { serverEnvSchema, type ServerEnv } from './server-env.js';
import { clientEnvSchema, type ClientEnv } from './client-env.js';

export function loadServerConfig(env: Record<string, unknown> = process.env): ServerEnv {
  return validateEnv(serverEnvSchema, env);
}

export function loadClientConfig(env: Record<string, unknown> = process.env): ClientEnv {
  return validateEnv(clientEnvSchema, env);
}
