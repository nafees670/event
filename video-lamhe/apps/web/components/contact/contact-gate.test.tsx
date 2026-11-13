import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPendingAction, savePendingAction } from '@/lib/contact/pending';
import { useAuthStore } from '@/stores/auth';
import { useWhatsappPicker } from '@/stores/whatsapp-picker';
import { ContactGate } from './contact-gate';
import { PendingActionRunner } from './pending-action-runner';

const push = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname,
}));

const user = {
  id: 'u1',
  name: 'Test',
  email: 't@example.com',
  phone: '923001234567',
  role: 'customer' as const,
  avatarUrl: null,
  themePreference: 'light' as const,
  isEmailVerified: false,
};

function Gate() {
  return (
    <ContactGate
      action="whatsapp"
      context={{ operatorSlug: 'sample-op', operatorName: '[Sample Operator 1]' }}
    >
      <button type="button">WhatsApp</button>
    </ContactGate>
  );
}

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  pathname = '/';
  window.history.pushState({}, '', '/');
  useWhatsappPicker.setState({ open: false, context: {} });
});

describe('ContactGate', () => {
  it('sends guests to /login with returnTo, action and target, and remembers the action', async () => {
    useAuthStore.setState({ status: 'guest', user: null, accessToken: null });
    window.history.pushState({}, '', '/shorts?city=karachi');
    render(<Gate />);
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));

    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    const url = new URL(push.mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('returnTo')).toBe('/shorts?city=karachi');
    expect(url.searchParams.get('action')).toBe('whatsapp');
    expect(url.searchParams.get('target')).toBe('sample-op');
    expect(loadPendingAction()).toMatchObject({
      action: 'whatsapp',
      returnTo: '/shorts?city=karachi',
      context: { operatorName: '[Sample Operator 1]' },
    });
    expect(useWhatsappPicker.getState().open).toBe(false);
  });

  it('runs the action immediately for logged-in users', async () => {
    useAuthStore.setState({ status: 'authenticated', user, accessToken: 't' });
    render(<Gate />);
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    await waitFor(() => expect(useWhatsappPicker.getState().open).toBe(true));
    expect(useWhatsappPicker.getState().context.operatorName).toBe('[Sample Operator 1]');
    expect(push).not.toHaveBeenCalled();
  });

  it('waits for the initial session check before deciding', async () => {
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null });
    render(<Gate />);
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(push).not.toHaveBeenCalled();
    useAuthStore.setState({ status: 'authenticated', user, accessToken: 't' });
    await waitFor(() => expect(useWhatsappPicker.getState().open).toBe(true));
  });
});

describe('PendingActionRunner', () => {
  it('resumes the saved action once logged in on the returnTo page', async () => {
    pathname = '/shorts';
    savePendingAction({
      action: 'whatsapp',
      context: { operatorName: '[Sample Operator 1]' },
      returnTo: '/shorts?city=karachi',
      createdAt: Date.now(),
    });
    useAuthStore.setState({ status: 'guest', user: null, accessToken: null });
    render(<PendingActionRunner />);
    expect(useWhatsappPicker.getState().open).toBe(false);

    useAuthStore.setState({ status: 'authenticated', user, accessToken: 't' });
    await waitFor(() => expect(useWhatsappPicker.getState().open).toBe(true));
    expect(loadPendingAction()).toBeNull(); // runs once
  });

  it('does not run on a different page', async () => {
    pathname = '/login';
    savePendingAction({ action: 'whatsapp', returnTo: '/shorts', createdAt: Date.now() });
    useAuthStore.setState({ status: 'authenticated', user, accessToken: 't' });
    render(<PendingActionRunner />);
    await new Promise((r) => setTimeout(r, 20));
    expect(useWhatsappPicker.getState().open).toBe(false);
    expect(loadPendingAction()).not.toBeNull();
  });
});
