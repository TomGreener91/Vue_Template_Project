const fs = require('fs');
const path = require('path');
const {
  templatesDir,
  projectRoot,
  IS_DEBUG,
  copyDirectoryRecursive,
  updateRootPackageScripts,
  copyCompositeAction,
  setupPipelineWorkflow
} = require('../utils.cjs');

/**
 * Orchestrates the setup of an Electron desktop application.
 * Handles templates, scripts, and workflows specific to Electron releases.
 */
async function setupElectron() {
  console.log('\nSetting up for Electron App...');
  const electronTemplateDir = path.join(templatesDir, 'electron-app');
  copyDirectoryRecursive(
    path.join(electronTemplateDir, 'electron'),
    path.join(projectRoot, 'electron'),
    {},
  );

  const forgeConfigSrc = path.join(electronTemplateDir, 'forge.config.cjs');
  const forgeConfigDest = path.join(projectRoot, 'forge.config.cjs');

  if (IS_DEBUG) {
    console.log(`[DEBUG] Would copy forge.config.cjs to ${forgeConfigDest}`);
  } else {
    fs.copyFileSync(forgeConfigSrc, forgeConfigDest);
  }

  // Copy composite actions needed for Electron
  copyCompositeAction('setup-node-build');
  copyCompositeAction('release-electron');

  // Define the Electron release job YAML
  const deployJobYaml = `  release-electron:
    name: Build & Release Electron (\${{ matrix.os }})
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}

      - name: Build & Upload Release
        uses: ./.github/actions/release-electron
        with:
          version: \${{ needs.release.outputs.new_release_version }}`;

  // Set up the unified pipeline workflow
  await setupPipelineWorkflow(deployJobYaml);

  // Update package.json scripts
  updateRootPackageScripts({
    "electron:start": "electron-forge start",
    "electron:package": "electron-forge package",
    "electron:make": "electron-forge make"
  });

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageJson.main = 'electron/main.cjs';
      
      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies['electron'] = '^44.0.0';
      packageJson.devDependencies['@electron-forge/cli'] = '^7.11.2';
      packageJson.devDependencies['@electron-forge/maker-deb'] = '^7.11.2';
      packageJson.devDependencies['@electron-forge/maker-rpm'] = '^7.11.2';
      packageJson.devDependencies['@electron-forge/maker-squirrel'] = '^7.11.2';
      packageJson.devDependencies['@electron-forge/maker-zip'] = '^7.11.2';
      packageJson.devDependencies['@electron-forge/plugin-fuses'] = '^7.11.2';
      packageJson.devDependencies['@electron/fuses'] = '^2.1.3';
      packageJson.devDependencies['electron-squirrel-startup'] = '^1.0.0';

      if (IS_DEBUG) {
        console.log(`[DEBUG] Would update package.json with Electron main entry and dependencies`);
      } else {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('Updated package.json for Electron.');
      }
    } catch (e) {
      console.error('Failed to update package.json:', e.message);
    }
  }

  const readmeSrc = path.join(electronTemplateDir, 'README.md');
  const readmeDest = path.join(projectRoot, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy Electron App README.md to ${readmeDest}`);
    } else {
      fs.copyFileSync(readmeSrc, readmeDest);
      console.log('Copied Electron App README.md to project root.');
    }
  }
}

module.exports = setupElectron;