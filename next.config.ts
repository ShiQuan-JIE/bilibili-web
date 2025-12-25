import type { NextConfig } from "next";

const CLOUDBASE_STATIC_DOMAIN =
  process.env.NEXT_PUBLIC_CLOUDBASE_STATIC_DOMAIN || "https://cloud1-3gy44slx114f4c73-1258339218.tcloudbaseapp.com";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i0.hdslb.com",
        pathname: "/bfs/**",
      },
      {
        protocol: "https",
        hostname: "i1.hdslb.com",
        pathname: "/bfs/**",
      },
      {
        protocol: "https",
        hostname: "i2.hdslb.com",
        pathname: "/bfs/**",
      },
      {
        protocol: "https",
        hostname: "i3.hdslb.com",
        pathname: "/bfs/**",
      },
      {
        protocol: "https",
        hostname: "636c-cloud1-3gy44slx114f4c73-1258339218.tcb.qcloud.la",
      },
    ],
  },
  // 暂时移除重写规则，避免影响RSC正常工作
  // async rewrites() {
  //   return [
  //     {
  //       source: "/__auth/:path*",
  //       destination: `${CLOUDBASE_STATIC_DOMAIN}/__auth/:path*`,
  //     },
  //   ];
  // },
};

export default nextConfig;
