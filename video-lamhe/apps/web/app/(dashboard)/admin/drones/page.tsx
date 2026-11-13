import type { Metadata } from 'next';
import { DronesAdmin } from '@/components/admin/drones-admin';

export const metadata: Metadata = { title: 'Drones' };

export default function AdminDronesPage() {
  return <DronesAdmin />;
}
