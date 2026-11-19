import type { Metadata } from "next";
import { LanguageProvider } from "../components/language-provider.tsx";
import { SiteHeader } from "../components/site-header.tsx";
import { getLanguage } from "../lib/language-server.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: "TasteSift — Turn any link into a recipe",
  description: "A private, intelligent recipe library for your family.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getLanguage();
  return (
    <html lang={language === "zh" ? "zh-Hans" : "en"}>
      <body className="antialiased">
        <LanguageProvider initialLanguage={language}>
        <SiteHeader />
        {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
