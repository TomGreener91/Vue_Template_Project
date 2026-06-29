const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', 'ios');
if (!fs.existsSync(iosDir)) {
  console.log('iOS platform not found. Skipping iOS patch.');
  process.exit(0);
}

const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: package.json not found in root directory.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Calculate bundleId
const ownerRaw = packageJson.author || packageJson.owner || "company";
let ownerStr = '';
if (typeof ownerRaw === 'string') {
  ownerStr = ownerRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
} else if (typeof ownerRaw === 'object' && ownerRaw.name) {
  ownerStr = ownerRaw.name.toLowerCase().replace(/[^a-z0-9]/g, '');
} else {
  ownerStr = "company";
}

const nameStr = (packageJson.name || "app").toString().toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
const bundleId = `com.${ownerStr}.${nameStr}`;

// Calculate version
const versionStr = (packageJson.version || "1.0").toString();

// Calculate display name (human readable)
const appName = packageJson.name || "App";
let humanAppName = appName.replace(/-/g, ' ').replace(/_/g, ' ');
// Capitalize words
humanAppName = humanAppName.replace(/\b\w/g, c => c.toUpperCase());


// 1. Update project.pbxproj
const pbxprojPath = path.join(iosDir, 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxprojPath)) {
  let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf-8');

  // Replace PRODUCT_BUNDLE_IDENTIFIER
  pbxprojContent = pbxprojContent.replace(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*[^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`);

  // Replace MARKETING_VERSION
  pbxprojContent = pbxprojContent.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${versionStr};`);

  fs.writeFileSync(pbxprojPath, pbxprojContent, 'utf-8');
  console.log('Successfully patched ios/App/App.xcodeproj/project.pbxproj');
} else {
  console.error('Warning: project.pbxproj not found.');
}

// 2. Update Info.plist
const plistPath = path.join(iosDir, 'App', 'App', 'Info.plist');
if (fs.existsSync(plistPath)) {
  let plistContent = fs.readFileSync(plistPath, 'utf-8');

  // Replace CFBundleDisplayName
  const displayNameRegex = /(<key>CFBundleDisplayName<\/key>\s*<string>)([^<]*)(<\/string>)/g;
  if (displayNameRegex.test(plistContent)) {
    plistContent = plistContent.replace(displayNameRegex, `$1${humanAppName}$3`);
  }

  // Also replace CFBundleName just in case
  const bundleNameRegex = /(<key>CFBundleName<\/key>\s*<string>)([^<]*)(<\/string>)/g;
  if (bundleNameRegex.test(plistContent)) {
    plistContent = plistContent.replace(bundleNameRegex, `$1${humanAppName}$3`);
  }

  fs.writeFileSync(plistPath, plistContent, 'utf-8');
  console.log('Successfully patched ios/App/App/Info.plist');
} else {
  console.error('Warning: Info.plist not found.');
}
