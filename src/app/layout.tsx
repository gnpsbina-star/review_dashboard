import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans_Devanagari, Sora } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700"] });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Smart Review Platform", template: "%s · Smart Review Platform" },
  description: "Smart Review Platform by Synergy Technologies",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F7F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1513" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${sora.variable} ${devanagari.variable}`}>
      <body>{children}</body>
    </html>
  );
}
