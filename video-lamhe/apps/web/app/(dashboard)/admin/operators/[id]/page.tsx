import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OperatorAdminForm } from '@/components/admin/operator-admin-form';

export const metadata: Metadata = { title: 'Edit operator' };

export default async function EditOperatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  return <OperatorAdminForm id={id} />;
}
