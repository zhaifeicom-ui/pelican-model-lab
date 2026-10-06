import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "鹈鹕实验室 · Pelican Model Lab",
  description: "记录模型回答，预览 SVG 与 HTML，并排观察每一次鹈鹕自行车实验。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
