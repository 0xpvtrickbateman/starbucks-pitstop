import type { Metadata } from "next";
import { Geist, Fraunces, IBM_Plex_Sans_Condensed } from "next/font/google";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://starbucks-pitstop.vercel.app",
  ),
  title: {
    default: "Starbucks Pitstop",
    template: "%s | Starbucks Pitstop",
  },
  description:
    "Crowdsourced restroom keypad codes for qualifying Starbucks locations, built for fast mobile lookups.",
  applicationName: "Starbucks Pitstop",
  category: "utilities",
  appleWebApp: {
    capable: true,
    title: "Starbucks Pitstop",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "Starbucks Pitstop",
    description:
      "Crowdsourced restroom keypad codes for qualifying Starbucks locations, built for fast mobile lookups.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Starbucks Pitstop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Starbucks Pitstop",
    description:
      "Crowdsourced restroom keypad codes for qualifying Starbucks locations, built for fast mobile lookups.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  themeColor: "#1f4a3d",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${fraunces.variable} ${plexCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-surface-base text-text-primary">
        {children}
      </body>
    </html>
  );
}
