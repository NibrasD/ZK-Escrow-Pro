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

    // Force Terser to support modules for Top-Level Await
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          if (minimizer.options && minimizer.options.terserOptions) {
            minimizer.options.terserOptions.module = true;
          }
        }
      });
    }

    return config;
  },
}

module.exports = nextConfig
