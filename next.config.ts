import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF first (about 20% smaller than WebP), WebP for browsers without it.
    formats: ["image/avif", "image/webp"],
    // Every `quality` a <Image> asks for: 70 the category tiles, 75 the rest. A value not listed is
    // rounded to the nearest one that is (Next 16 allows only 75 by default).
    qualities: [70, 75],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        // HTTPS only from the first visit over HTTPS on (browsers ignore it over plain http and on
        // localhost). No includeSubDomains or preload: they would also lock out any subdomain that is
        // not on HTTPS. The http to https redirect itself is a host setting (docs/seo.md).
        headers: [{ key: "Strict-Transport-Security", value: "max-age=31536000" }],
      },
    ];
  },
};

export default nextConfig;
