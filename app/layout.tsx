import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
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
  title: "Punchline Passport | One joke, three cultures",
  description: "Share a joke in English, Spanish, or Chinese and Punchline Passport retells it for the other two cultures. Rate whether each version is still funny.",
};

// Match the system color scheme before the first paint, and keep following it while the page is open.
const themeScript = `(function(){var m=matchMedia("(prefers-color-scheme: dark)");function a(){document.documentElement.setAttribute("data-theme",m.matches?"dark":"light")}a();m.addEventListener("change",a)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
