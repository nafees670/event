import type { Metadata } from 'next';
import { OperatorAdminForm } from '@/components/admin/operator-admin-form';

export const metadata: Metadata = { title: 'Add operator' };

export default function NewOperatorPage() {
  return <OperatorAdminForm />;
}
