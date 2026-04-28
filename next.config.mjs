/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "doctors.kg", pathname: "/**" },
      { protocol: "http", hostname: "doctors.kg", pathname: "/**" },
    ],
  },
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
