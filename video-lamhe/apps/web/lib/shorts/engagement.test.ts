import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeContactAction } from '@/lib/contact/execute';
import { useAuthStore } from '@/stores/auth';
import { useShortEngagement } from '@/stores/short-engagement';
import { recordViewOnce, setShortLiked } from './engagement';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });

beforeEach(() => {
  useShortEngagement.getState().clear();
  useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('setShortLiked', () => {
  it('updates optimistically, then takes the server count', async () => {
    let release!: (r: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => (release = r)));
    const p = setShortLiked('s1', true, 10);
    expect(useShortEngagement.getState()).toMatchObject({
      liked: { s1: true },
      likeCount: { s1: 11 },
    });
    release(ok({ liked: true, likeCount: 12 }));
    await p;
    expect(useShortEngagement.getState().likeCount.s1).toBe(12);
  });

  it('rolls back when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'x' } }), {
        status: 500,
      }),
    );
    await setShortLiked('s1', true, 10);
    expect(useShortEngagement.getState()).toMatchObject({
      liked: { s1: false },
      likeCount: { s1: 10 },
    });
  });
});

describe('gated like after login', () => {
  it('applies the like (never toggles an existing like off)', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(ok({ liked: true, likeCount: 1 }));
    executeContactAction({ action: 'like', context: { shortId: 's9' } });
    await vi.waitFor(() => expect(useShortEngagement.getState().liked.s9).toBe(true));
    expect(fetch.mock.calls[0]![1]!.method).toBe('POST');

    fetch.mockClear();
    executeContactAction({ action: 'like', context: { shortId: 's9' } }); // already liked
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('recordViewOnce', () => {
  it('posts a view once per short per session', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ ok: true }));
    recordViewOnce('a');
    recordViewOnce('a');
    recordViewOnce('b');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
