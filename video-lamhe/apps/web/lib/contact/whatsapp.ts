import type { WhatsappContactInput, WhatsappContactResult } from '@video-lamhe/shared';
import { api } from '@/lib/api/client';

/**
 * Opens WhatsApp in a new tab without tripping popup blockers: the tab is opened
 * synchronously inside the click handler, then pointed at the link once the API answers.
 */
export async function openWhatsapp(input: WhatsappContactInput): Promise<void> {
  const win = window.open('', '_blank');
  if (win) {
    try {
      win.document.title = 'Opening WhatsApp…';
      win.document.body.style.cssText = 'font-family:system-ui;padding:2rem;color:#5E574D';
      win.document.body.textContent = 'Opening WhatsApp…';
    } catch {
      // ignore — purely cosmetic
    }
  }
  try {
    const { waLink } = await api<WhatsappContactResult>('/contact/whatsapp', {
      method: 'POST',
      body: input,
    });
    if (win && !win.closed) {
      win.opener = null;
      win.location.href = waLink;
    } else {
      // Popup blocked → navigate this tab instead.
      window.location.href = waLink;
    }
  } catch (err) {
    win?.close();
    throw err;
  }
}
