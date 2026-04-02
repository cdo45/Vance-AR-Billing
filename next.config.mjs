/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native Node module — must stay server-side only
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
