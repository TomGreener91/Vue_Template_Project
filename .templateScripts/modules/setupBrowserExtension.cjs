const path = require('path');
const fs = require('fs');
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
 * Orchestrates the setup of a Browser Extension project.
 * Handles templates and workflows specific to browser extension releases.
 */
async function setupBrowserExtension() {
  console.log('\nSetting up for Browser Extension...');
  const extensionTemplateDir = path.join(templatesDir, 'browser-extension');
  copyDirectoryRecursive(
    path.join(extensionTemplateDir, 'public'),
    path.join(projectRoot, 'public'),
    {},
  );
  copyDirectoryRecursive(path.join(extensionTemplateDir, 'src'), path.join(projectRoot, 'src'), {});
  
  // Copy composite actions needed for browser extension
  copyCompositeAction('setup-node-build');
  copyCompositeAction('release-extension');

  // Define the Browser Extension release job YAML
  const deployJobYaml = `  release-extension:
    name: Package & Release Extension
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}

      - name: Build & Upload Release
        uses: ./.github/actions/release-extension
        with:
          version: \${{ needs.release.outputs.new_release_version }}`;

  // Set up the unified pipeline workflow
  await setupPipelineWorkflow(deployJobYaml);

  // Ensure root build script handles standard builds
  updateRootPackageScripts({
    "build": "vue-tsc --noEmit && vite build"
  });

  const readmeSrc = path.join(extensionTemplateDir, 'README.md');
  const readmeDest = path.join(projectRoot, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy Browser Extension README.md to ${readmeDest}`);
    } else {
      fs.copyFileSync(readmeSrc, readmeDest);
      console.log('Copied Browser Extension README.md to project root.');
    }
  }

  console.log('Browser Extension files copied.');
}

module.exports = setupBrowserExtension;