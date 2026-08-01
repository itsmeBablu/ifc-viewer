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
      suppressHydrationWarning
    >
      <head>
        {/* Blocking theme vars — must live in <head> (Next.js 16 script ordering). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='ifc-viewer:colorTheme',t=localStorage.getItem(k);if(t!=='dark'&&t!=='light')return;document.documentElement.dataset.theme=t;var p=t==='dark'?{b:'#0f1419',f:'#e4e4e7',s:'#2a3340',ts:'#f4f4f5',tb:'#d4d4d8',tm:'#a1a1aa'}:{b:'#cfd5df',f:'#18181b',s:'#e8eaed',ts:'#18181b',tb:'#3f3f46',tm:'#71717a'};var r=document.documentElement.style;r.setProperty('--background',p.b);r.setProperty('--foreground',p.f);r.setProperty('--scene-bg',p.s);r.setProperty('--text-strong',p.ts);r.setProperty('--text-body',p.tb);r.setProperty('--text-muted',p.tm);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full overflow-hidden overscroll-none bg-[var(--background)] text-[var(--foreground)] touch-manipulation">
        {children}
      </body>
    </html>
  );
}
