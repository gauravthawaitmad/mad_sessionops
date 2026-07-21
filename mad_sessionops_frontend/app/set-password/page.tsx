import { Metadata } from "next";
import { SplitAuthLayout } from "@/components/auth/common/SplitAuthLayout";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata: Metadata = {
  title: "Set Password | MAD Platform",
  description: "Set your MAD Platform password",
};

export default function SetPasswordPage() {
  return (
    <SplitAuthLayout
      title="Set your password"
      subtitle="Create a secure password to sign in with email."
      backHref="/login"
      backLabel="Back to sign in"
    >
      <SetPasswordForm />
    </SplitAuthLayout>
  );
}
