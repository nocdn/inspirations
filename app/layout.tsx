import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const isDevelopment = process.env.NODE_ENV === "development"

const inter = Inter({
  variable: "--font-inter",
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
      <body className={`${inter.variable} bg-background`}>
        {children}
      </body>
    </html>
  )
}
