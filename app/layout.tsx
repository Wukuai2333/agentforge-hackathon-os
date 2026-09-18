import type { Metadata } from "next";
import "./globals.css";
import "./selection-clawmax.css";
import "./account-onboarding.css";

export const metadata: Metadata = {
  title: "AgentForge — Personal Agent Hackathon",
  description: "Plan, build, teach, and demonstrate a personal AI agent in one day.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
