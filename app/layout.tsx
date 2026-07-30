import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IBV Viewer",
  description:
    "Client-side IFC viewer for building heating load (Heizlast) and room temperature visualization",
  icons: {
    icon: [{ url: "/ibv.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/ibv.svg", type: "image/svg+xml" }],
    apple: [{ url: "/ibv.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f4f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-hidden overscroll-none bg-zinc-100 text-zinc-900 touch-manipulation">
        {children}
      </body>
    </html>
  );
}
