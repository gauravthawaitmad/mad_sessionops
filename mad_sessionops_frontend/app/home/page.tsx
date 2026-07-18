import { Metadata } from "next";
import { Sidebar } from "@/components/layout";

export const metadata: Metadata = {
  title: "Home | MAD Platform",
  description: "Welcome to MAD Platform account",
};

export default function HomePage() {
  return (
    <div>
      <Sidebar open={true} />
    </div>
  );
}
