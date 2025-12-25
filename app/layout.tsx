import type { Metadata } from "next";
import { Chivo, Space_Mono } from "next/font/google";
import "./globals.css";

const chivo = Chivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-chivo",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Bilibili 数据调度台",
  description: "可视化查看 bilibili-data 集合的观测数据",
  referrer: "no-referrer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${chivo.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
