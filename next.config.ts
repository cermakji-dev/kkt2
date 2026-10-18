import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint běží samostatně (npm run lint); build kvůli němu nepadá.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Fotky z kontrol se nahrávají přes server actions (zmenšené v prohlížeči).
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
