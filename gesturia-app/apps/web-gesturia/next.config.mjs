/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // compile the shared workspace package (TS source) directly
  transpilePackages: ["@gesturia/core"],
};
export default nextConfig;
