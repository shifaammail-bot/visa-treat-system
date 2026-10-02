/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // react-pdf runs in Node; keep it out of the webpack bundle.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // The PDF route reads fonts and logos from disk; make sure deploys ship them.
    outputFileTracingIncludes: {
      "/documents/[id]/pdf": ["./lib/pdf/fonts/**/*", "./public/logos/**/*"],
    },
  },
};

export default nextConfig;
