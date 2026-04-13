/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  transpilePackages: ["@aleohq/sdk", "@demox-labs/aleo-wallet-adapter-base"],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
      };
    }

    // Definitive Fix for Aleo SDK + Render:
    // Disable minification in production to bypass 'top-level await' parser errors in workers.
    config.optimization.minimize = false;

    return config;
  },
}

module.exports = nextConfig
