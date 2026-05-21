const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  turbopack: {
    resolveAlias: {
      // @mujoco/mujoco tries to import('module') to build require(); shim it for browser
      module: { browser: './src/lib/node-module-shim.js' },
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        module: path.resolve(__dirname, 'src/lib/node-module-shim.js'),
      };
    }
    config.module.rules.push({ test: /\.wasm$/, type: 'asset/resource' });
    return config;
  },
};
