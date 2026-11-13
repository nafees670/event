import { create } from 'zustand';
import type { ShortEngagement } from '@video-lamhe/shared';

/** The viewer's likes/saves + live like counts (overrides the cached public counts). */
interface State {
  liked: Record<string, boolean>;
  saved: Record<string, boolean>;
  likeCount: Record<string, number>;
  merge: (eng: ShortEngagement, ids: string[]) => void;
  set: (id: string, patch: { liked?: boolean; saved?: boolean; likeCount?: number }) => void;
  clear: () => void;
}

export const useShortEngagement = create<State>((set) => ({
  liked: {},
  saved: {},
  likeCount: {},
  merge: (eng, ids) =>
    set((s) => {
      const liked = { ...s.liked };
      const saved = { ...s.saved };
      for (const id of ids) {
        liked[id] = eng.liked.includes(id);
        saved[id] = eng.saved.includes(id);
      }
      return { liked, saved };
    }),
  set: (id, patch) =>
    set((s) => ({
      liked: patch.liked === undefined ? s.liked : { ...s.liked, [id]: patch.liked },
      saved: patch.saved === undefined ? s.saved : { ...s.saved, [id]: patch.saved },
      likeCount:
        patch.likeCount === undefined ? s.likeCount : { ...s.likeCount, [id]: patch.likeCount },
    })),
  clear: () => set({ liked: {}, saved: {}, likeCount: {} }),
}));
