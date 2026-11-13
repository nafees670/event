import { create } from 'zustand';
import type { ContactContext } from '@/lib/contact/types';

interface WhatsappPickerState {
  open: boolean;
  context: ContactContext;
  openPicker: (context: ContactContext) => void;
  close: () => void;
}

export const useWhatsappPicker = create<WhatsappPickerState>((set) => ({
  open: false,
  context: {},
  openPicker: (context) => set({ open: true, context }),
  close: () => set({ open: false }),
}));
