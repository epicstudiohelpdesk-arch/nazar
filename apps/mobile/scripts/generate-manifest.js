const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function getGitCommitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '0000000000000000000000000000000000000000';
  }
}

function calculateFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const monorepoRoot = path.resolve(projectRoot, '../..');
  const distDir = path.resolve(projectRoot, 'dist');

  const appJsonPath = path.resolve(projectRoot, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  const expoConfig = appJson.expo;

  const gitSha = getGitCommitSha();
  const timestamp = new Date().toISOString();

  // Inspect artifacts in dist
  const artifacts = [];
  if (fs.existsSync(distDir)) {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(projectRoot, fullPath);
          const size = fs.statSync(fullPath).size;
          const sha256 = calculateFileSha256(fullPath);
          artifacts.push({
            path: relativePath,
            sizeBytes: size,
            sha256,
          });
        }
      }
    };
    walk(distDir);
  }

  const manifest = {
    product: expoConfig.name,
    version: expoConfig.version,
    androidVersionCode: expoConfig.android.versionCode,
    iosBuildNumber: expoConfig.ios.buildNumber,
    environment: 'production',
    commit: gitSha,
    buildTimestamp: timestamp,
    apiCompatibilityVersion: 'v1',
    mobileConfigurationVersion: '1.0.0',
    bundleIdentifier: expoConfig.ios.bundleIdentifier,
    androidPackage: expoConfig.android.package,
    signingIdentities: {
      android: {
        keyAlias: 'nazar-release-key',
        keystoreType: 'PKCS12 / JKS',
        playAppSigning: 'ENROLLED',
        certificateFingerprintSha256:
          '14:6D:E9:7D:0F:52:AB:E0:16:D4:F4:79:20:FB:0B:FD:E1:92:07:3E:68:57:3E:F8:78:E5:94:0A:78:B1:A7:F9',
      },
      ios: {
        signingCertificate: 'Apple Distribution: Nazar Technologies Inc.',
        teamId: 'TEAMID1234',
        provisioningProfile: 'Nazar AppStore Distribution Profile',
        associatedDomainsVerified: true,
      },
    },
    releaseEndpoints: {
      apiBaseUrl: 'https://api.nazar.app/v1',
      wsUrl: 'wss://api.nazar.app',
      deepLinkScheme: 'nazar',
      deepLinkDomains: ['nazar.app', 'links.nazar.app'],
    },
    artifacts,
  };

  const outputFiles = [
    path.resolve(projectRoot, 'RELEASE_MANIFEST.json'),
    path.resolve(monorepoRoot, 'RELEASE_MANIFEST.json'),
  ];

  for (const file of outputFiles) {
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Release manifest generated: ${file}`);
  }
}

main();
