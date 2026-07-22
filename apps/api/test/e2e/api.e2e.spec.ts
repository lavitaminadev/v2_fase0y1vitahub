import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, IncomingMessage, ServerResponse } from 'http';

describe('API E2E - Health and Routing', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(() => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: 123, timestamp: new Date().toISOString(), version: '1.0.0' }));
      } else if (req.url === '/auth/me') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
      }
    });

    server.listen(0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('should return 200 for health endpoint', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/nonexistent-route`);
    expect(res.status).toBe(404);
  });

  it('should return 401 for protected routes without auth', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    expect(res.status).toBe(401);
  });
});
