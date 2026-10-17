import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Simulado de medicina",
  description: "Gera 10 questões de residência a partir de um PDF ou DOCX.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} antialiased`}>{children}</body>
    </html>
  );
}
