import type { Metadata } from 'next';
import { OperatorsAdmin } from '@/components/admin/operators-admin';

export const metadata: Metadata = { title: 'Operators' };

type SP = Promise<{ status?: string }>;

export default async function AdminOperatorsPage({ searchParams }: { searchParams: SP }) {
  const { status } = await searchParams;
  return <OperatorsAdmin initialStatus={status === 'pending' ? 'pending' : undefined} />;
}
