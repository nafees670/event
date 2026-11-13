import type { Metadata } from 'next';
import { OperatorDashboard } from '@/components/operator/operator-dashboard';

export const metadata: Metadata = { title: 'Operator dashboard', robots: { index: false } };

export default function OperatorDashboardPage() {
  return <OperatorDashboard />;
}
