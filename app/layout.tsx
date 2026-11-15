import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://crolyo.ameyashr.in"),
  title: {
    default: "Crolyo - Slack-Native Live Chat for Your Website",
    template: "%s — Crolyo",
  },
  description:
    "Drop a lightweight chat widget on your site. Every visitor message lands in your Slack channel. Reply right there, in real-time.",
  openGraph: {
    type: "website",
    siteName: "Crolyo",
    title: "Crolyo - Slack-Native Live Chat for Your Website",
    description:
      "Drop a lightweight chat widget on your site. Every visitor message lands in your Slack channel. Reply right there, in real-time.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Crolyo — Slack-native live chat for your website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crolyo - Slack-Native Live Chat for Your Website",
    description:
      "Drop a lightweight chat widget on your site. Every visitor message lands in your Slack channel. Reply right there, in real-time.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
