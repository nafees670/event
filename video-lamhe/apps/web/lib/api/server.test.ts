import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
  notFound.mockClear();
});

describe('serverApi', () => {
  it('returns data and meta', async () => {
    respond(200, { data: [1], meta: { page: 1 } });
    const { serverApi } = await import('./server');
    await expect(serverApi('/x')).resolves.toEqual({ data: [1], meta: { page: 1 } });
  });

  it('404 → notFound() by default (pages)', async () => {
    respond(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
    const { serverApi } = await import('./server');
    await expect(serverApi('/x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404 → { data: null } with allowMissing (generateMetadata), never throws', async () => {
    respond(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
    const { serverApi } = await import('./server');
    await expect(serverApi('/x', { allowMissing: true })).resolves.toEqual({
      data: null,
      meta: undefined,
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it('other errors throw ServerApiError with the API code', async () => {
    respond(500, { error: { code: 'INTERNAL_ERROR', message: 'boom' } });
    const { serverApi } = await import('./server');
    await expect(serverApi('/x', { allowMissing: true })).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('qs skips empty values', async () => {
    const { qs } = await import('./server');
    expect(qs({ a: 'x', b: undefined, c: '', d: 2 })).toBe('?a=x&d=2');
    expect(qs({})).toBe('');
  });
});
