import type { Metadata } from "next";
import { Lora, Inter, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { FarcasterMiniApp } from "../components/FarcasterMiniApp";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const appName = "PlotLink";
const appDescription =
  "Tokenise your story from day 1. Publish plots, drive trading, earn royalties from every trade — powered by the market, not a platform.";
const themeColor = "#E8DFD0";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: appName,
  description: appDescription,
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/plotlink-logo-symbol.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.json",
  openGraph: {
    title: appName,
    description: appDescription,
    url: appUrl,
    siteName: appName,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: appName,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appDescription,
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName,
  },
  other: {
    "theme-color": themeColor,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${inter.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <FarcasterMiniApp />
          <NavBar />
          <div className="pt-11 min-h-screen">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
