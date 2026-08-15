import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nook — your home, remembered",
    template: "%s · Nook",
  },
  description:
    "Map rooms, photograph storage spaces, and remember exactly where every item lives.",
  applicationName: "Nook",
  appleWebApp: {
    capable: true,
    title: "Nook",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f0e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
