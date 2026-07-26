import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const base = host ? `${protocol}://${host}` : "http://localhost:4173";
  const title = "Kuku Coffee 智能咖啡站";
  const description = "选择、定制、制作、取杯，让 Kuku 陪你完成一杯刚刚好的咖啡。";

  return {
    title,
    description,
    icons: {
      icon: "/og.png",
      shortcut: "/og.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${base}/og.png`, width: 979, height: 1606, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${base}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          as="image"
          href="/assets/reference/k1.png"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/reference/k2-impact.png"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/reference/k2.png"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
