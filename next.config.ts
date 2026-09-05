import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Tauri serves the frontend as static files from `out/`, so there is no Node
  // server at runtime: no server components, route handlers, or image
  // optimization. All data access goes through Tauri commands.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
