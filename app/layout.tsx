import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/app-providers";
import { TwaRoot } from "@/components/twa-root";
import { APP_NAME } from "@/constants";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
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
    <html lang="ky">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-emerald-50 font-sans text-emerald-950 antialiased`}
      >
        <TwaRoot />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
