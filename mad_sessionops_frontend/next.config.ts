// eslint-disable-next-line @typescript-eslint/no-require-imports -- this file is loaded as CommonJS (module.exports below), not compiled as an ES module
const { withSentryConfig } = require("@sentry/nextjs");

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

module.exports = withSentryConfig(nextConfig, {
  // Which Sentry org/project source maps upload to — set once DSN/project exist.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Build-time only; never exposed to the client. See Dockerfile for how this
  // is passed in as a BuildKit secret rather than a persisted build ARG.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
