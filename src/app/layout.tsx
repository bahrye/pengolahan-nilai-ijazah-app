import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/** Tanpa ini, beberapa perangkat memakai lebar layout “desktop” lalu mengecilkan halaman (terasa zoom out). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  title: "Sistem Nilai Ijazah",
  description:
    "Pengelolaan nilai ujian, rapor, dan rekap ijazah untuk madrasah.",
};

function GlobalFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/60 bg-slate-50/80 py-4 text-center text-[12px] text-slate-500 backdrop-blur dark:border-slate-700/50 dark:bg-slate-950/95 dark:text-slate-500">
      <p>
        © {new Date().getFullYear()} <span className="font-semibold text-slate-700 dark:text-slate-300">Syamsul Bahri</span> — Dibangun untuk kemajuan pendidikan Indonesia
      </p>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
        <AppProviders>
          <div className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col">
            <div className="flex-1 w-full min-w-0">{children}</div>
            <GlobalFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
