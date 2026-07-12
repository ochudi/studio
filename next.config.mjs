/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // The invoice PDF reads its fonts off the filesystem at render time;
    // make sure Vercel's function bundle actually contains them.
    outputFileTracingIncludes: {
      "/api/invoices/[id]/pdf": ["./public/fonts/**/*"],
    },
  },
  async headers() {
    return [
      {
        // The whole app is private. Belt and braces alongside robots.txt:
        // nothing here should ever be indexed or cached publicly.
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
