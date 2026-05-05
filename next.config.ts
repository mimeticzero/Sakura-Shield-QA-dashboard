import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GITHUB_REPO: process.env.NEXT_PUBLIC_GITHUB_REPO ?? 'mimeticzero/Sakura-Shield-QA-dashboard',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'sakuranode.com' },
      { protocol: 'https', hostname: 'sakurarewards.com' },
      { protocol: 'https', hostname: 'sakurafidelity.com' },
      { protocol: 'https', hostname: 'img.shields.io' },
    ],
  },
}

export default nextConfig
