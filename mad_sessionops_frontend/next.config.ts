/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ✅ Add security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer-when-downgrade',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
