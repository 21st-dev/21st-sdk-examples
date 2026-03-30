import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://21st.dev https://www.21st.dev;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
