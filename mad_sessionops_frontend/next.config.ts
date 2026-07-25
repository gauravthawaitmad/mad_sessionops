/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Skip the on-the-fly optimizer (/_next/image) — it depends on `sharp`,
  // which isn't installed here and fails silently (image shows only its
  // alt text). All our images are already small, local, static assets, so
  // there's nothing to gain from runtime optimization anyway.
  images: {
    unoptimized: true,
  },
  // ✅ Add security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer-when-downgrade",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
