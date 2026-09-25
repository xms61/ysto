// The only module that reads environment variables. Every variable is validated once, at startup,
// and listed in .env.example.

export interface Config {
  port: number;
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`PORT must be an integer from 1 to ${MAX_PORT}, got "${value}"`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return { port: parsePort(env.PORT) };
}
