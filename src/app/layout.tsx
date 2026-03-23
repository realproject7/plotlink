import type { Metadata } from "next";
import { Lora, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { FarcasterMiniApp } from "../components/FarcasterMiniApp";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "PlotLink",
  description: "Tokenise your story from day 1. Publish plots, drive trading, earn royalties from every trade — powered by the market, not a platform.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${geistMono.variable} antialiased`}>
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
