/** @type {import('next').NextConfig} */
import type { Configuration } from 'webpack';

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
  },
  output: 'export',
  images: {
    unoptimized: true
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://localhost:3007',
    'http://192.168.0.37:3000',
    'http://192.168.0.37:3001',
    'http://192.168.0.37:3002',
    'http://192.168.0.37:3003',
    'http://192.168.0.37:3004',
    'http://192.168.0.37:3005',
    'http://192.168.0.37:3006',
    'http://192.168.0.37:3007'
  ],
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  experimental: {
    turbo: {
      rules: {
        '*.{js,jsx,ts,tsx}': ['swc-loader'],
      },
    },
  },
};

export default nextConfig;