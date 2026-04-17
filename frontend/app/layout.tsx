import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madagascar Freshwater Fish Conservation Platform",
  description:
    "Open-source platform for Madagascar's endemic freshwater fish — species profiles, distribution, and conservation coordination.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
