import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api/client';
import { useShortEngagement } from '@/stores/short-engagement';

const store = () => useShortEngagement.getState();

/** Optimistic like/unlike with rollback on failure. */
export async function setShortLiked(id: string, liked: boolean, currentCount: number) {
  const before = {
    liked: store().liked[id] ?? false,
    likeCount: store().likeCount[id] ?? currentCount,
  };
  if (before.liked !== liked) {
    store().set(id, { liked, likeCount: Math.max(0, before.likeCount + (liked ? 1 : -1)) });
  }
  try {
    const r = await api<{ liked: boolean; likeCount: number }>(`/shorts/${id}/like`, {
      method: liked ? 'POST' : 'DELETE',
    });
    store().set(id, r);
  } catch (err) {
    store().set(id, before);
    if (!(err instanceof ApiError && err.code === 'RATE_LIMITED'))
      toast.error('Couldn’t update the like. Try again.');
  }
}

export async function setShortSaved(id: string, saved: boolean) {
  const before = store().saved[id] ?? false;
  store().set(id, { saved });
  try {
    await api(`/shorts/${id}/save`, { method: saved ? 'POST' : 'DELETE' });
    if (saved) toast.success('Saved to your account');
  } catch (err) {
    store().set(id, { saved: before });
    if (!(err instanceof ApiError && err.code === 'RATE_LIMITED'))
      toast.error('Couldn’t save. Try again.');
  }
}

const VIEWED_KEY = 'vl-viewed';

/** Counts a view once per short per browser session. */
export function recordViewOnce(id: string) {
  try {
    const seen = new Set<string>(
      JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? '[]') as string[],
    );
    if (seen.has(id)) return;
    seen.add(id);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    // storage unavailable — still count
  }
  void api(`/shorts/${id}/view`, { method: 'POST' }).catch(() => undefined);
}
