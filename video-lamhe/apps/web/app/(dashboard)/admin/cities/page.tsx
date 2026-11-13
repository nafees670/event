import type { Metadata } from 'next';
import { CitiesAdmin } from '@/components/admin/cities-admin';

export const metadata: Metadata = { title: 'Cities' };

export default function AdminCitiesPage() {
  return <CitiesAdmin />;
}
