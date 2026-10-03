/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // react-pdf runs in Node; keep it out of the webpack bundle.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // The PDF route reads fonts and logos from disk; make sure deploys ship them.
    outputFileTracingIncludes: {
      // pdfkit loads its built-in fonts (Helvetica…) by computed path, which
      // file tracing can't see — include them explicitly.
      "/documents/[id]/pdf": [
        "./lib/pdf/fonts/**/*",
        "./public/logos/**/*",
        "./node_modules/pdfkit/js/standard-fonts/**/*",
        "./node_modules/pdfkit/js/data/**/*",
      ],
    },
  },
};

export default nextConfig;
