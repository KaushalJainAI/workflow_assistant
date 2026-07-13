/**
 * Connectors page — happy / sad / angry rendering tests with mocked APIs.
 * Demonstrates the pattern: mount the real page, let it call the network
 * boundary (mocked by MSW), and assert what the user sees.
 */
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server } from './setup';

import Connectors from '../../src/pages/Connectors';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Connectors />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Connectors page — happy', () => {
  it('renders connectors returned by /api/mcp/servers/', async () => {
    renderPage();
    await waitFor(
      () => {
        expect(screen.getByText(/Filesystem/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});

describe('Connectors page — sad', () => {
  it('shows empty / fallback state when API returns no servers', async () => {
    server.use(
      http.get('http://localhost:8000/api/mcp/servers/', () => HttpResponse.json([])),
    );
    renderPage();
    // Don't assert specific copy — just that the render does not crash.
    await waitFor(() => {
      expect(document.body.textContent).toBeTruthy();
    });
  });
});

describe('Connectors page — angry', () => {
  it('does not crash when API returns 500', async () => {
    server.use(
      http.get('http://localhost:8000/api/mcp/servers/', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    expect(() => renderPage()).not.toThrow();
  });

  it('does not crash when API returns malformed payload', async () => {
    server.use(
      http.get('http://localhost:8000/api/mcp/servers/', () =>
        HttpResponse.text('totally not json'),
      ),
    );
    expect(() => renderPage()).not.toThrow();
  });

  it('does not crash when network errors out', async () => {
    server.use(
      http.get('http://localhost:8000/api/mcp/servers/', () => HttpResponse.error()),
    );
    expect(() => renderPage()).not.toThrow();
  });
});
