import type { NextConfig } from "next";

const isGH = process.env.GITHUB_ACTIONS === "true" && process.env.DEPLOY_TARGET === "gh-pages";
const basePath = isGH ? "/spiral_turn_footcalc" : "";

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
  // Use static export for Firebase Hosting and GitHub Pages
  output: "export",
  basePath: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
