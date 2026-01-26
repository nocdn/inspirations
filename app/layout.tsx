import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google"

import "./globals.css"

const isDevelopment = process.env.NODE_ENV === "development"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: isDevelopment ? "inspirations (dev)" : "inspirations",
  description: isDevelopment ? "inspirations (dev)" : "inspirations",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetBrainsMono.variable} ${playfairDisplay.variable} bg-background`}
      >
        {children}
      </body>
    </html>
  )
}
