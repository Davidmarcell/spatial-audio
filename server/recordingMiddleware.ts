import type { IncomingMessage, ServerResponse } from 'node:http';
import { discoverRecordings } from './recordingDiscovery';

/** Same-origin, bounded endpoint. Never accepts media URLs or client tokens. */
export function recordingMiddleware(token?: string) {
  let windowStart = Date.now();
  let requests = 0;
  let active = 0;
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/recordings') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (code: number, body: unknown) => { res.statusCode = code; res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(405, { error: 'GET required' }); }
    if (req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Same-origin requests only' });
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error: 'Same-origin requests only' }); }
      catch { return reply(403, { error: 'Invalid origin' }); }
    }
    if ((req.url?.length ?? 0) > 1500) return reply(400, { error: 'Request too long' });
    const name = url.searchParams.get('name')?.trim() ?? '';
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    if (!name || name.length > 200 || !url.searchParams.has('lat') || !url.searchParams.has('lng')
      || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return reply(400, { error: 'A named location and valid coordinates are required' });
    }
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
    if (++requests > 30 || active >= 4) { res.setHeader('Retry-After', '60'); return reply(429, { error: 'Please try again shortly' }); }
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    active++;
    try {
      const result = await discoverRecordings({
        name, lat, lng, countryCode: url.searchParams.get('countryCode') ?? undefined,
        habitat: url.searchParams.get('habitat') ?? undefined,
      }, { token, signal: controller.signal });
      if (!res.destroyed) reply(200, result);
    } catch {
      if (!res.destroyed) reply(503, { status: 'unavailable', recordings: [], message: 'Discovery is temporarily unavailable' });
    } finally { active--; res.off('close', abort); }
  };
}
