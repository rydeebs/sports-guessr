import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MomentGuessr",
  description: "Guess the place and year behind famous sports moments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
