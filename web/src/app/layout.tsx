import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { TopNav } from "@/components/top-nav";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ClearPath — Pre-Op Anesthesia Clearance",
  description:
    "AI pre-operative anesthesia clearance triage. Runs over FHIR patient data and returns a structured clearance decision in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TopNav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
