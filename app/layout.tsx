import type { Metadata, Viewport } from "next";
import { fontSans } from "@/lib/config/fonts";
import { SITE, SITE_IS_PLACEHOLDER } from "@/lib/config/site";
import { pageColor } from "@/lib/config/themeColor.server";
import "./globals.css";

/**
 * What search engines and link previews read (lib/config/site.ts holds the values). The share image is
 * app/opengraph-image.jpg (docs/make-og-image.mjs); X falls back to the Open Graph title, text and image.
 * No `robots` field: the default is indexable. No canonical while the site's address is a placeholder.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.name}` },
  description: SITE.description,
  alternates: SITE_IS_PLACEHOLDER ? undefined : { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  verification: SITE.googleVerification ? { google: SITE.googleVerification } : undefined,
};

/** The page is white and light only (D4): the browser's own bars match it (web interface guidelines: theme-color). Next's default viewport meta stays. */
export function generateViewport(): Viewport {
  return { themeColor: pageColor(), colorScheme: "light" };
}

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
