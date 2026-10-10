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

export const metadata: Metadata = {
  title: "AIStore — Find the best AI tools",
  description:
    "A curated directory of the best open and open-source AI tools. Chat, coding, image generation, voice, agents, automation, and more — independently reviewed.",
  keywords: [
    "AI tools",
    "open source AI",
    "AI directory",
    "ChatGPT alternative",
    "self-hosted AI",
    "AI agents",
  ],
  authors: [{ name: "AIStore" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "AIStore — Find the best AI tools",
    description: "Curated AI tools for the way you work with AI.",
    siteName: "AIStore",
    type: "website",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-base text-ink`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
