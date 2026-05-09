import type { NextConfig } from "next";

function getTelefunWebSocketCspSource() {
  const rawUrl = process.env.NEXT_PUBLIC_TELEFUN_WS_URL;
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
    if (protocol !== 'wss:' && protocol !== 'ws:') return '';
    return `${protocol}//${url.host}`;
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    const telefunWsSource = getTelefunWebSocketCspSource();
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https://picsum.photos https://*.supabase.co https://api.dicebear.com;
      font-src 'self' data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      connect-src 'self' https://*.supabase.co https://*.googleapis.com https://generativelanguage.googleapis.com https://va.vercel-scripts.com wss://*.railway.app wss://*.up.railway.app ${telefunWsSource};
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kkeiiwyyefaofljippnj.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        path: false,
        stream: false,
        crypto: false,
      };
      // Handle node: prefix
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }
    return config;
  },
};

export default nextConfig;
