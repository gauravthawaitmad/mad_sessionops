import type { Metadata } from "next";
import "./globals.css";
import App from "next/app";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "MAD Platform",
  description: "Production-ready Next.js application",
  referrer: 'no-referrer-when-downgrade',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Add this meta tag */}
        <meta name="referrer" content="no-referrer-when-downgrade" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
