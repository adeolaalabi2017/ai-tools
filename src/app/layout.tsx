import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Absolute base for the share image and other metadata URLs. Set SITE_URL to
   the public origin in production; without it Next falls back to localhost. */
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Open AI Stack — Open-source alternatives to popular AI tools",
  description:
    "A curated directory of open-source and source-available AI tools, each matched to the product it replaces. Chat, coding, images, voice, agents and automation, reviewed by editors.",
  keywords: [
    "AI tools",
    "open source AI",
    "AI directory",
    "ChatGPT alternative",
    "self-hosted AI",
    "AI agents",
  ],
  authors: [{ name: "Open AI Stack" }],
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Open AI Stack — Open-source alternatives to popular AI tools",
    description: "Open-source alternatives to the AI tools you use.",
    siteName: "Open AI Stack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const themeInit = `try{var t=localStorage.getItem('aistore-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-base text-ink`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
