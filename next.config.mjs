/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "doctors.kg", pathname: "/**" },
      { protocol: "http", hostname: "doctors.kg", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    serverComponentsExternalPackages: ["pdf-parse", "tesseract.js"],
  },
};

export default nextConfig;
