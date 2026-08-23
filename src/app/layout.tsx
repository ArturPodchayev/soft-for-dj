import type { Metadata } from "next";
import { headingFont, sansFont } from "@/lib/fonts";
import { VENUE } from "@/config/venue";
import "./globals.css";

export const metadata: Metadata = {
  title: VENUE.eventName,
  description: `Live song requests for ${VENUE.eventName}`,
};

// The only place VENUE.colors gets turned into actual CSS — every component
// reads the resulting `brand-*` Tailwind utilities (see globals.css's
// `@theme inline` block), never VENUE.colors directly. Re-skinning for a
// different DJ/venue is therefore always "edit config/venue.ts," with zero
// changes here or in any component.
function brandStyleVars() {
  const c = VENUE.colors;
  return {
    "--brand-bg": c.background,
    "--brand-fg": c.foreground,
    "--brand-accent": c.accent,
    "--brand-accent-2": c.accentSecondary,
    "--brand-surface": c.surface,
    "--brand-surface-fg": c.surfaceForeground,
  } as React.CSSProperties;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${headingFont.variable} ${sansFont.variable} h-full antialiased`}
      style={brandStyleVars()}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
