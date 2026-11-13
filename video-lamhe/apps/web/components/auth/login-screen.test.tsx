import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPendingAction, savePendingAction } from '@/lib/contact/pending';
import { useAuthStore } from '@/stores/auth';
import { LoginScreen } from './login-screen';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ status: 'guest', user: null, accessToken: null });
});

const pending = {
  action: 'whatsapp' as const,
  context: { operatorSlug: 'sample-op', operatorName: '[Sample Operator 1]' },
  returnTo: '/operators/sample-op',
  createdAt: Date.now(),
};

describe('LoginScreen pending action handling', () => {
  it('keeps a matching pending action and names the operator', async () => {
    savePendingAction(pending);
    search = 'returnTo=%2Foperators%2Fsample-op&action=whatsapp&target=sample-op';
    render(<LoginScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Log in to WhatsApp [Sample Operator 1]' }),
    ).toBeInTheDocument();
    expect(loadPendingAction()).not.toBeNull();
  });

  it('drops a leftover pending action when this login was not started by it', async () => {
    savePendingAction(pending);
    search = 'returnTo=%2F'; // e.g. header "Log in" later in the session
    render(<LoginScreen />);
    await waitFor(() => expect(loadPendingAction()).toBeNull());
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
