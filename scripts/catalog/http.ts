// HTTP for the ingest scripts: a User-Agent that names the repo, and retries with backoff on rate
// limits (429, honoring Retry-After), server errors and network failures. Tests pass a fake fetch and
// sleep, so no test touches the network.

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;

export interface HttpClient {
  fetch: Fetch;
  sleep: Sleep;
}

export const USER_AGENT = 'ysto-catalog (+https://github.com/xms61/ysto)';
const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

export const realHttp: HttpClient = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter !== null && retryAfter.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
}

async function attempt(http: HttpClient, url: string, init: RequestInit): Promise<Response | Error> {
  try {
    return await http.fetch(url, init);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function send(http: HttpClient, url: string, init: RequestInit): Promise<Response> {
  const request: RequestInit = { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } };
  for (let tries = 1; ; tries++) {
    const result = await attempt(http, url, request);
    if (result instanceof Response && result.ok) return result;
    const status = result instanceof Response ? result.status : null;
    const retriable = status === null || status === 429 || status >= 500;
    if (!retriable || tries >= MAX_ATTEMPTS) {
      const reason = result instanceof Response ? `HTTP ${result.status}` : result.message;
      throw new Error(`${request.method ?? 'GET'} ${url} failed after ${tries} attempt(s): ${reason}`);
    }
    await http.sleep(backoffMs(tries, result instanceof Response ? result.headers.get('retry-after') : null));
  }
}

export async function getJson(http: HttpClient, url: string): Promise<unknown> {
  return (await send(http, url, { headers: { Accept: 'application/json' } })).json();
}

export async function postJson(http: HttpClient, url: string, body: unknown): Promise<unknown> {
  const init = {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  return (await send(http, url, init)).json();
}

export async function getBytes(http: HttpClient, url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await send(http, url, {})).arrayBuffer());
}
