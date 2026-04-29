import { Metadata } from 'next';
import { SplitAuthLayout } from '@/components/auth/common/SplitAuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Login | MAD Platform',
  description: 'Login to your MAD Platform account',
};

export default function LoginPage() {
  return (
    <SplitAuthLayout
      title="Welcome back"
      subtitle="Enter your credentials to access your account"
    >
      <LoginForm />
    </SplitAuthLayout>
  );
}
