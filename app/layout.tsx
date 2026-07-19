import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Pixel display face — non-variable, single weight.
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

// Mono body/UI face — variable, covers the 400/500/700 weights the theme uses.
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Juega, compite y conquista el salón de la fama arcade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetBrainsMono.variable}`}
    >
      {/* suppressHydrationWarning: browser extensions (Grammarly, ColorZilla, Dark
          Reader, password managers) inject attributes into <body> before React
          hydrates. This suppresses that unavoidable, extension-only attribute
          mismatch on <body> itself — it does NOT hide mismatches in our own tree. */}
      <body suppressHydrationWarning>
        {/* Neon-arcade backdrop: perspective grid + scanlines + vignette, then film grain. */}
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <div className="av-shell">{children}</div>
      </body>
    </html>
  );
}
