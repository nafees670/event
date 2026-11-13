import type { Metadata } from 'next';
import { DashboardPlaceholder } from '@/components/layout/dashboard-placeholder';
import { SavedShorts } from '@/components/shorts/saved-shorts';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default function AccountPage() {
  return (
    <DashboardPlaceholder label="My account" comingIn="Phases 5–7 (bookings, chats)">
      <SavedShorts />
    </DashboardPlaceholder>
  );
}
