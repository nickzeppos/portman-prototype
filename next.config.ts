import type { NextConfig } from 'next';

// Set NEXT_PUBLIC_BASE_PATH at build time when deploying to a subpath
// (e.g. NEXT_PUBLIC_BASE_PATH=/portman for username.github.io/portman).
// Leave unset for local dev and custom-domain deploys.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  ...(basePath && { basePath, assetPrefix: `${basePath}/` }),
};

export default nextConfig;
