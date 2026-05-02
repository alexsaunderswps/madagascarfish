import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import { notFound } from "next/navigation";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { routing } from "@/i18n/routing";
import "../globals.css";

const spectral = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Malagasy Freshwater Fishes Conservation Platform",
  description:
    "Open-source platform for Madagascar's endemic freshwater fish — species profiles, distribution, and conservation coordination.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }
  // Static-rendering opt-in: tells next-intl which locale this route is
  // for so server components rendered statically pick the right messages.
  setRequestLocale(locale);

  // Load this locale's catalog so client islands (NavLinks,
  // LocaleSwitcher) get a populated provider. Server components use
  // getTranslations() directly and don't need this — but client
  // components consume from the provider context.
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthSessionProvider>
            <SiteHeader />
            <div id="main-content" className="flex-1">
              {children}
            </div>
            <SiteFooter />
          </AuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
