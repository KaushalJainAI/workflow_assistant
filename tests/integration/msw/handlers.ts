import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8000';

// Default fixtures — override in individual tests with server.use(...)
export const handlers = [
  http.post(`${BASE}/api/auth/login/`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body?.email || !body?.password) {
      return HttpResponse.json({ detail: 'Missing field' }, { status: 400 });
    }
    if (body.password === 'wrong') {
      return HttpResponse.json({ detail: 'Invalid' }, { status: 401 });
    }
    return HttpResponse.json({ access: 'fake-jwt', refresh: 'fake-refresh' });
  }),

  http.get(`${BASE}/api/auth/profile/`, () =>
    HttpResponse.json({ id: 1, username: 'alice', email: 'alice@example.com' }),
  ),

  http.get(`${BASE}/api/orchestrator/workflows/`, () => HttpResponse.json({ results: [] })),

  http.post(`${BASE}/api/orchestrator/workflows/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 42, ...body }, { status: 201 });
  }),

  http.get(`${BASE}/api/credentials/credentials/`, () => HttpResponse.json([])),
  http.get(`${BASE}/api/credentials/credential-types/`, () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'GitHub',
        slug: 'github',
        fields_schema: [{ name: 'token', label: 'Token', type: 'password', required: true }],
      },
    ]),
  ),

  http.get(`${BASE}/api/mcp/servers/`, () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'Filesystem',
        type: 'stdio',
        required_credential_types: [],
        enabled: true,
        user: null,
      },
      {
        id: 2,
        name: 'GitHub',
        type: 'stdio',
        required_credential_types: ['github'],
        enabled: true,
        user: null,
      },
    ]),
  ),
];
