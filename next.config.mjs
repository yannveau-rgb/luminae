/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // La page widget est chargée dans une iframe sur des sites tiers.
        source: '/widget',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' }
        ]
      },
      {
        source: '/embed.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300' }
        ]
      }
    ];
  }
};

export default nextConfig;
