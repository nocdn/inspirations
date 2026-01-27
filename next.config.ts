import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  devIndicators: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "images.bartoszbak.org",
      },
    ],
  },
}

export default nextConfig
