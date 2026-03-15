import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { FarcasterMiniApp } from "../components/FarcasterMiniApp";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlotLink",
  description: "Collaborative on-chain storytelling",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`}>
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
