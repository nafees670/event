import type { Metadata } from 'next';
import { ShortsAdmin } from '@/components/admin/shorts-admin';

export const metadata: Metadata = { title: 'Shorts' };

export default function AdminShortsPage() {
  return <ShortsAdmin />;
}
