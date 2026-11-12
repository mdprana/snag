import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Atkinson_Hyperlegible, Saira } from "next/font/google";
import "./globals.css";

const display = Saira({ subsets: ["latin"], axes: ["wdth"], variable: "--font-saira" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: "Snag",
  description: "Free games on Epic and Steam, one tap to claim.",
};

export const viewport: Viewport = { themeColor: "#0b0a09", viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><a href="#main" className="skip-link">Skip to content</a>{children}</body>
    </html>
  );
}
