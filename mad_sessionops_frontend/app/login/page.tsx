import { Metadata } from "next";
import { SplitAuthLayout } from "@/components/auth/common/SplitAuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Session-Ops",
  description: "Sign in to Session-Ops",
};

export default function LoginPage() {
  return (
    <SplitAuthLayout title="Sign in to continue">
      <LoginForm />
    </SplitAuthLayout>
  );
}
