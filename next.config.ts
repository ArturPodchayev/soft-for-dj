import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Album art / thumbnails can come from iTunes, YouTube, or a
    // moderator-pasted URL from any host (see lib/albumArt.ts) — display
    // components render them `unoptimized` for that reason, same as
    // aut-dj-party, so no remotePatterns allowlist is required here.
  },
};

export default nextConfig;
