const fs = require('fs');
const path = require('path');
const {
  templatesDir,
  projectRoot,
  IS_DEBUG,
  updateRootPackageScripts,
  copyCompositeAction,
  setupPipelineWorkflow,
  selectOption
} = require('../utils.cjs');

/**
 * Orchestrates the setup of a main web app project.
 * Copies required composite actions and sets up the single unified CI/CD pipeline.
 */
async function setupProject() {
  console.log('\nSetting up for Project Development...');

  // Always copy base setup-node-build action
  copyCompositeAction('setup-node-build');

  // Ask for Hosting Platform
  console.log('');
  const hostingPlatform = await selectOption('Which hosting platform would you like to use for deployment?', [
    { label: 'GitHub Pages', value: 'github-pages' },
    { label: 'Firebase Hosting', value: 'firebase' },
    { label: 'Azure Static Web Apps', value: 'azure' },
    { label: 'None / Skip', value: 'none' },
  ]);

  let deployJobYaml = '';

  if (hostingPlatform === 'github-pages') {
    copyCompositeAction('deploy-github-pages');
    deployJobYaml = `  deploy-github-pages:
    name: Deploy to GitHub Pages
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: ubuntu-latest
    concurrency:
      group: 'pages'
      cancel-in-progress: true
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}

      - name: Deploy
        id: deployment
        uses: ./.github/actions/deploy-github-pages
        with:
          build-command: 'npm run build'
          dist-path: './dist'`;
  } else if (hostingPlatform === 'firebase') {
    copyCompositeAction('deploy-firebase');
    deployJobYaml = `  deploy-firebase-preview:
    name: Firebase PR Preview Deploy
    needs: health-check
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup & Build
        uses: ./.github/actions/setup-node-build
        with:
          build-command: 'npm run build'

      - name: Deploy to Firebase Preview Channel
        uses: ./.github/actions/deploy-firebase
        with:
          firebase-service-account: \${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          project-id: \${{ secrets.FIREBASE_PROJECT_ID }}

  deploy-firebase:
    name: Deploy to Firebase Hosting
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}

      - name: Setup & Build
        uses: ./.github/actions/setup-node-build
        with:
          build-command: 'npm run build'

      - name: Deploy to Firebase
        uses: ./.github/actions/deploy-firebase
        with:
          firebase-service-account: \${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          project-id: \${{ secrets.FIREBASE_PROJECT_ID }}`;
  } else if (hostingPlatform === 'azure') {
    copyCompositeAction('deploy-azure');
    deployJobYaml = `  deploy-azure-preview:
    name: Azure PR Preview Deploy
    needs: health-check
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: true

      - name: Setup & Build
        uses: ./.github/actions/setup-node-build
        with:
          build-command: 'npm run build'

      - name: Deploy to Azure Preview
        uses: ./.github/actions/deploy-azure
        with:
          azure-token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}

  deploy-azure:
    name: Deploy to Azure Static Web Apps
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}
          submodules: true

      - name: Setup & Build
        uses: ./.github/actions/setup-node-build
        with:
          build-command: 'npm run build'

      - name: Deploy to Azure
        uses: ./.github/actions/deploy-azure
        with:
          azure-token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}`;
  }

  // Set up the unified pipeline workflow
  await setupPipelineWorkflow(deployJobYaml);

  // Ensure root build script can handle workspaces, building workspaces FIRST
  updateRootPackageScripts({
    "build": "vue-tsc --noEmit && vite build"
  });

  // Clean up unused plugin pkgRoot entry from .releaserc.json if present
  const releasercPath = path.join(projectRoot, '.releaserc.json');
  if (fs.existsSync(releasercPath)) {
    try {
      const releaserc = JSON.parse(fs.readFileSync(releasercPath, 'utf-8'));
      if (releaserc.plugins) {
        releaserc.plugins = releaserc.plugins.filter(
          (p) => !(Array.isArray(p) && p[0] === '@semantic-release/npm' && p[1] && p[1].pkgRoot && p[1].pkgRoot.includes('{{PLUGIN_NAME}}'))
        );
        fs.writeFileSync(releasercPath, JSON.stringify(releaserc, null, 2));
      }
    } catch (e) {
      // ignore
    }
  }

  // Copy root README.md for the web app
  const readmeSrc = path.join(templatesDir, 'web-app', 'README.md');
  const readmeDest = path.join(projectRoot, 'README.md');
  try {
    if (fs.existsSync(readmeSrc)) {
      if (IS_DEBUG) {
        console.log(`[DEBUG] Would copy Web App README.md to ${readmeDest}`);
      } else {
        fs.copyFileSync(readmeSrc, readmeDest);
        console.log('Copied Web App README.md to project root.');
      }
    }
  } catch (e) {
    console.error('Failed to copy Web App README.md:', e.message);
  }

  console.log('Project setup complete.');
}

module.exports = setupProject;