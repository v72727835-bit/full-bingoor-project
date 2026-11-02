import type { NextConfig } from 'next';

// The cPanel host caps processes and has no native SWC, so its deploy script
// sets BINGOOR_LOW_RESOURCE=1: one build worker, no forked webpack worker, and
// type checks left to CI (they take minutes under the WASM compiler there).
const lowResource = process.env.BINGOOR_LOW_RESOURCE === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A new value on every build: the app download links carry it, so a phone never reuses an old answer for them.
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  ...(lowResource
    ? {
        typescript: { ignoreBuildErrors: true },
        experimental: { cpus: 1, workerThreads: true, webpackBuildWorker: false },
      }
    : {}),
};

export default nextConfig;
