import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["expo", "expo-screen-orientation", "expo-modules-core", "react-native-web", "react-native"],
  webpack: (config, { webpack }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
    };
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
      })
    );
    return config;
  },
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
