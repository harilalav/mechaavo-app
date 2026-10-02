import type { Metadata } from "next";
import { fontSans } from "@/lib/config/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mechaavo Tackles - Engineered for every cast",
  description:
    "Premium fishing tackle engineered with precision, innovation, and reliability. Designed for anglers who demand performance when it matters most.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontSans.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions (Grammarly adds data-gr-ext-installed and data-new-gr-c-s-check-loaded) write attributes onto <body> before React hydrates; one level deep, so mismatches in the page itself still warn */}
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-page font-sans text-ink-soft">
        <a href="#hero-copy" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
