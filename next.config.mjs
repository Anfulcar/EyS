/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
export default nextConfig;
