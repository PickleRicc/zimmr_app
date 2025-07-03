/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure trailingSlash is false for dynamic routes to work properly
  trailingSlash: false,
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Avoid including canvg (browser-only) in the server bundle – jsPDF pulls it in and it breaks SSR build
    if (isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        canvg: false
      };
    }
    return config;
  }
};

module.exports = nextConfig;
