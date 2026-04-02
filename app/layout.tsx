import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vance Corp – AR Billing Tracker",
  description: "Internal billing tracker for Vance Corp heavy equipment rentals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
