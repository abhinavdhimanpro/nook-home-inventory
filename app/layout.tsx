import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nook - your home, remembered",
    template: "%s · Nook",
  },
  description:
    "Map rooms, photograph storage spaces, and remember exactly where every item lives.",
  applicationName: "Nook",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Nook",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
