/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  transpilePackages: ["@aleohq/sdk", "@demox-labs/aleo-wallet-adapter-base"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
      layers: true,
      outputModule: true,
    };
    return config;
  },
}

module.exports = nextConfig
