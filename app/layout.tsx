import type { Metadata } from "next"
import { Inter } from "next/font/google"
import localFont from "next/font/local"

import "./globals.css"

const isDevelopment = process.env.NODE_ENV === "development"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const ppSupplyMono = localFont({
  src: "./fonts/PPSupplyMono-Variable.woff2",
  variable: "--font-pp-supply-mono",
  display: "swap",
})

const ppNeueMontreal = localFont({
  src: "./fonts/PPNeueMontreal-Variable.woff2",
  variable: "--font-pp-neue-montreal",
  display: "swap",
})

const ioskeleyMono = localFont({
  src: [
    { path: "./fonts/IoskeleyMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IoskeleyMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IoskeleyMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ioskeley-mono",
  display: "swap",
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
      <body className={`${inter.variable} ${ppSupplyMono.variable} ${ppNeueMontreal.variable} ${ioskeleyMono.variable} bg-background`}>
        {children}
      </body>
    </html>
  )
}
