// Resolves `@talqui-oss/talqui-sdk-reactnative` to the SDK source one folder up, so
// the example always runs the code next to it. In your app none of this is
// needed: install the package from npm.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { '@talqui-oss/talqui-sdk-reactnative': path.join(root, 'src') };
// One copy of React and React Native: the example's, never the SDK's dev copies.
const escape = (p) => p.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${escape(path.join(root, 'node_modules'))}\\/.*$`)];

module.exports = config;
