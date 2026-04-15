import "./globals.css";
import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import localFont from "next/font/local";
import { AppProviders } from "@/components/app-providers";
import { TwaRoot } from "@/components/twa-root";
import { APP_NAME } from "@/constants";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Health companion — Emerald Kyrgyzstan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} ${manrope.variable} ${geistMono.variable} min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d] antialiased`}
      >
        <TwaRoot />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
