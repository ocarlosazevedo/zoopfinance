import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoop Finance",
  description: "Financial management for global entrepreneurs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
