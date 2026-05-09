import type { Metadata } from "next";
import { Prompt, Inter } from "next/font/google";
import "reactflow/dist/style.css";
import "./globals.css";
import "@/lib/i18n";
import { Providers } from "./providers";

const prompt = Prompt({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TestCase Visual",
  description: "Test Case Management Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} ${inter.variable} h-full antialiased`}>
      <body className="h-full min-h-screen bg-bg-primary text-text-primary">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}