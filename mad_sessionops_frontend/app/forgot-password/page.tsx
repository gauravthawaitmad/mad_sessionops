import { Metadata } from 'next';
import { SplitAuthLayout } from '@/components/auth/common/SplitAuthLayout';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Set Password | Session-Ops',
  description: 'Set your Session-Ops password',
};

export default function ForgotPasswordPage() {
  return (
    <SplitAuthLayout
      title="Set your password"
      subtitle="Enter your email and we'll send you a link to set your password."
      backHref="/login"
      backLabel="Back to sign in"
    >
      <ForgotPasswordForm />
    </SplitAuthLayout>
  );
}
