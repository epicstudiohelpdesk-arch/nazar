const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// In monorepos sharing ESM/NodeNext conventions, imports within src/ frequently specify .js extensions.
// Metro resolver is configured here to resolve .js specifiers to .ts and .tsx source files seamlessly.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js') && (moduleName.startsWith('.') || moduleName.startsWith('@/'))) {
    const originDir = path.dirname(context.originModulePath);
    const candidateTs = moduleName.slice(0, -3) + '.ts';
    const candidateTsx = moduleName.slice(0, -3) + '.tsx';

    if (fs.existsSync(path.resolve(originDir, candidateTs))) {
      return context.resolveRequest(context, candidateTs, platform);
    }
    if (fs.existsSync(path.resolve(originDir, candidateTsx))) {
      return context.resolveRequest(context, candidateTsx, platform);
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
