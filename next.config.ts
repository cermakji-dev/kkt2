import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint běží samostatně (npm run lint); build kvůli němu nepadá.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
