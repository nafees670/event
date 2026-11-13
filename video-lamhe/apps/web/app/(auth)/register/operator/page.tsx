import type { Metadata } from 'next';
import { OperatorRegisterForm } from '@/components/operator/operator-register-form';

export const metadata: Metadata = {
  title: 'Join as an operator',
  description: 'List your wedding drone videography business on Video Lamhe.',
};

export default function OperatorRegisterPage() {
  return <OperatorRegisterForm />;
}
