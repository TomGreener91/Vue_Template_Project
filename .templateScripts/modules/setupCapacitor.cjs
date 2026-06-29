const fs = require('fs');
const path = require('path');
const {
  templatesDir,
  projectRoot,
  IS_DEBUG,
  updateRootPackageScripts,
  copyDirectoryRecursive,
  selectOption
} = require('../utils.cjs');

/**
 * Orchestrates the setup of a Capacitor mobile application.
 */
async function setupCapacitor() {
  console.log('\nSetting up for Capacitor App...');
  const capacitorTemplateDir = path.join(templatesDir, 'capacitor-app');
  
  // Copy Capacitor config
  const configSrc = path.join(capacitorTemplateDir, 'capacitor.config.ts');
  const configDest = path.join(projectRoot, 'capacitor.config.ts');

  if (fs.existsSync(configSrc)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy capacitor.config.ts to ${configDest}`);
    } else {
      fs.copyFileSync(configSrc, configDest);
      console.log('Copied capacitor.config.ts.');
    }
  }

  // Update package.json scripts
  updateRootPackageScripts({
    "cap:sync": "npx cap sync",
    "cap:open:android": "npx cap open android",
    "cap:open:ios": "npx cap open ios",
    "cap:build:android": "npx cap build android",
    "cap:build:ios": "npx cap build ios",
    "cap:add:android": "npx cap add android",
    "cap:add:ios": "npx cap add ios",
    "cap:patch": "node scripts/patch-android.js && node scripts/patch-ios.js"
  });

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      packageJson.dependencies = packageJson.dependencies || {};
      packageJson.dependencies['@capacitor/core'] = '^6.0.0';
      packageJson.dependencies['@capacitor/android'] = '^6.0.0';
      packageJson.dependencies['@capacitor/ios'] = '^6.0.0';

      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies['@capacitor/cli'] = '^6.0.0';

      if (IS_DEBUG) {
        console.log(`[DEBUG] Would update package.json with Capacitor dependencies`);
      } else {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('Updated package.json for Capacitor.');
      }
    } catch (e) {
      console.error('Failed to update package.json:', e.message);
    }
  }

  const readmeSrc = path.join(capacitorTemplateDir, 'README.md');
  const readmeDest = path.join(projectRoot, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy Capacitor App README.md to ${readmeDest}`);
    } else {
      fs.copyFileSync(readmeSrc, readmeDest);
      console.log('Copied Capacitor App README.md to project root.');
    }
  }

  // Copy patch scripts
  const scriptDestDir = path.join(projectRoot, 'scripts');
  if (!fs.existsSync(scriptDestDir)) {
    if (!IS_DEBUG) fs.mkdirSync(scriptDestDir, { recursive: true });
  }
  
  const patches = ['patch-android.js', 'patch-ios.js'];
  for (const patchFile of patches) {
    const patchSrc = path.join(capacitorTemplateDir, patchFile);
    const patchDest = path.join(scriptDestDir, patchFile);
    if (fs.existsSync(patchSrc)) {
      if (IS_DEBUG) {
        console.log(`[DEBUG] Would copy ${patchFile} to ${patchDest}`);
      } else {
        fs.copyFileSync(patchSrc, patchDest);
        console.log(`Copied ${patchFile} to scripts/.`);
      }
    }
  }

  // Ask for workflows
  console.log('');
  const workflowOption = await selectOption('Which CI/CD workflows would you like to configure?', [
    { label: 'Android Only', value: 'android' },
    { label: 'iOS Only', value: 'ios' },
    { label: 'Both Android and iOS', value: 'both' },
    { label: 'None / Skip', value: 'none' },
  ]);

  if (workflowOption !== 'none') {
    const workflowDestDir = path.join(projectRoot, '.github', 'workflows');
    if (!fs.existsSync(workflowDestDir)) {
      if (!IS_DEBUG) fs.mkdirSync(workflowDestDir, { recursive: true });
    }

    const workflows = [];
    if (workflowOption === 'android' || workflowOption === 'both') workflows.push('android-build.yml');
    if (workflowOption === 'ios' || workflowOption === 'both') workflows.push('ios-build.yml');

    for (const wf of workflows) {
      const workflowSrc = path.join(__dirname, '..', 'workflows', wf);
      const workflowDest = path.join(workflowDestDir, wf);

      if (fs.existsSync(workflowSrc)) {
        if (IS_DEBUG) {
          console.log(`[DEBUG] Would copy ${wf} to ${workflowDest}`);
        } else {
          fs.copyFileSync(workflowSrc, workflowDest);
          console.log(`Copied ${wf} GitHub Actions workflow.`);
        }
      }
    }
  }
}

module.exports = setupCapacitor;
