import type { IncomingMessage, ServerResponse } from 'node:http';

interface Options {
  /** How long a successful response is reused before fetching again. */
  cacheMs: number;
  /** Sent with successful responses, so the Vercel edge can cache them too. */
  cacheControl: string;
}

function sendJson(res: ServerResponse, status: number, body: string, cacheControl: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cacheControl);
  res.end(body);
}

/**
 * GET-only JSON route over a slow or rate-limited upstream: concurrent
 * requests share one fetch, results are cached, and when the upstream fails
 * the last good response is served instead of an error.
 */
export function cachedRoute<T>(load: () => Promise<T>, { cacheMs, cacheControl }: Options) {
  let cache: { at: number; body: string } | null = null;
  let inFlight: Promise<T> | null = null;

  return async function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET');
      res.end();
      return;
    }

    try {
      if (!cache || Date.now() - cache.at > cacheMs) {
        inFlight ??= load().finally(() => {
          inFlight = null;
        });
        cache = { at: Date.now(), body: JSON.stringify(await inFlight) };
      }
      sendJson(res, 200, cache.body, cacheControl);
    } catch (error) {
      console.error(`${req.url ?? 'route'}:`, (error as Error).message);
      if (cache) sendJson(res, 200, cache.body, cacheControl);
      else sendJson(res, 502, JSON.stringify({ error: 'upstream unavailable' }), 'no-store');
    }
  };
}
