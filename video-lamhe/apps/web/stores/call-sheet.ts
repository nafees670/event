import { create } from 'zustand';
import type { OperatorContactResult } from '@video-lamhe/shared';

interface CallSheetState {
  open: boolean;
  operatorName?: string;
  contact?: OperatorContactResult;
  show: (operatorName: string | undefined, contact: OperatorContactResult) => void;
  close: () => void;
}

export const useCallSheet = create<CallSheetState>((set) => ({
  open: false,
  show: (operatorName, contact) => set({ open: true, operatorName, contact }),
  close: () => set({ open: false }),
}));
