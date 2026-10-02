import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visa Treat Desk",
  description: "Visa processing desk for Arabiers Holidays, VisaTreat and Tourmate Tours",
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
