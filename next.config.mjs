/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allows CI/local verification to build away from an IDE-managed dev server
  // that owns `.next`; production keeps the standard directory by default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
