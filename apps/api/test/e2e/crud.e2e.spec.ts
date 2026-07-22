import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, IncomingMessage, ServerResponse } from 'http';

describe('CRUD E2E', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(() => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/auth/register' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => {
          const { email, password, name } = JSON.parse(body);
          if (!email || !password || !name) {
            res.writeHead(400);
            res.end(JSON.stringify({ message: 'Validation failed' }));
            return;
          }
          res.writeHead(201);
          res.end(JSON.stringify({
            accessToken: 'mock-token',
            refreshToken: 'mock-refresh',
            user: { id: '1', email, name, role: 'designer' },
          }));
        });
      } else if (req.url === '/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => {
          const { email, password } = JSON.parse(body);
          if (email === 'test@test.com' && password === 'password123') {
            res.writeHead(200);
            res.end(JSON.stringify({
              accessToken: 'mock-token',
              refreshToken: 'mock-refresh',
              user: { id: '1', name: 'Test', email, role: 'designer', avatarUrl: null },
            }));
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ message: 'Invalid credentials' }));
          }
        });
      } else {
        res.writeHead(404);
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

  it('should register a user via POST /auth/register', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123', name: 'Test' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body.user.email).toBe('test@test.com');
  });

  it('should login via POST /auth/login', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
  });
});
