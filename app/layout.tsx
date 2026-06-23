import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
      className={`${manrope.variable} h-full antialiased`}
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
