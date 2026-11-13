import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginHeading } from '@/components/auth/login-copy';
import {
  PENDING_TTL_MS,
  clearPendingAction,
  loadPendingAction,
  savePendingAction,
} from './pending';
import { pathOnly, sanitizeReturnTo } from './return-to';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/shorts?city=karachi', '/shorts?city=karachi'],
    ['/', '/'],
    [null, '/'],
    ['', '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/a\nb', '/'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it('pathOnly strips query and hash', () => {
    expect(pathOnly('/shorts?x=1#a')).toBe('/shorts');
  });
});

describe('pending action storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips and clears', () => {
    const p = { action: 'whatsapp' as const, returnTo: '/', createdAt: Date.now() };
    savePendingAction(p);
    expect(loadPendingAction()).toEqual(p);
    clearPendingAction();
    expect(loadPendingAction()).toBeNull();
  });

  it('drops expired and malformed entries', () => {
    savePendingAction({
      action: 'whatsapp',
      returnTo: '/',
      createdAt: Date.now() - PENDING_TTL_MS - 1,
    });
    expect(loadPendingAction()).toBeNull();
    sessionStorage.setItem(
      'vl-pending-action',
      JSON.stringify({ action: 'hack', returnTo: '/', createdAt: Date.now() }),
    );
    expect(loadPendingAction()).toBeNull();
    sessionStorage.setItem('vl-pending-action', '{not json');
    expect(loadPendingAction()).toBeNull();
  });
});

describe('loginHeading', () => {
  it('names the operator when known', () => {
    expect(loginHeading('whatsapp', '[Operator name]')).toBe('Log in to WhatsApp [Operator name]');
    expect(loginHeading('whatsapp')).toBe('Log in to continue on WhatsApp');
    expect(loginHeading('book', 'X')).toBe('Log in to book X');
    expect(loginHeading(null)).toBeNull();
    expect(loginHeading('bogus')).toBeNull();
  });
});

describe('openWhatsapp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the tab synchronously, then points it at the waLink', async () => {
    const fakeWin = {
      closed: false,
      opener: {},
      location: { href: '' },
      document: document.implementation.createHTMLDocument(),
      close: vi.fn(),
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeWin as unknown as Window);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { whatsapp: '923462590643', waLink: 'https://wa.me/923462590643?text=hi' },
        }),
        {
          status: 200,
        },
      ),
    );
    const { openWhatsapp } = await import('./whatsapp');
    const promise = openWhatsapp({ eventType: 'barat' });
    expect(open).toHaveBeenCalledWith('', '_blank'); // before any await → still inside the click gesture
    await promise;
    expect(fakeWin.location.href).toBe('https://wa.me/923462590643?text=hi');
    expect(fakeWin.opener).toBeNull();
  });

  it('closes the blank tab when the API fails', async () => {
    const fakeWin = {
      closed: false,
      opener: {},
      location: { href: '' },
      document: document.implementation.createHTMLDocument(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(fakeWin as unknown as Window);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'nope' } }), {
        status: 401,
      }),
    );
    const { openWhatsapp } = await import('./whatsapp');
    await expect(openWhatsapp({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fakeWin.close).toHaveBeenCalled();
  });
});
