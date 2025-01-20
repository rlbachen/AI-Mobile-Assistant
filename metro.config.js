// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add gguf to assetExts
config.resolver.assetExts.push("gguf");

// Optionally increase the max workers if needed
config.maxWorkers = 4;

// Increase the max file size (default is 32MB)
config.maxWorkers = 4;
config.transformer.maxWorkers = 2;
config.transformer.minifierConfig = {
  compress: {
    // Disable name mangling to keep file names readable
    keep_fnames: true,
    keep_classnames: true,
  },
};

module.exports = config;
