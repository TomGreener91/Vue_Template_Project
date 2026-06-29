const fs = require('fs');
const {
  templateScriptsDir,
  IS_DEBUG,
  selectOption,
  closeReadline
} = require('./utils.cjs');

const setupProject = require('./modules/setupProject.cjs');
const setupPlugin = require('./modules/setupPlugin.cjs');
const setupElectron = require('./modules/setupElectron.cjs');
const setupBrowserExtension = require('./modules/setupBrowserExtension.cjs');
const setupCapacitor = require('./modules/setupCapacitor.cjs');

async function main() {
  console.log('Welcome to the Template Setup Script!\n');

  const answer = await selectOption('Select an option:', [
    { label: 'Setup for Project Development (Main App)', value: '1' },
    { label: 'Setup for Plugin Development', value: '2' },
    { label: 'Setup for Electron App', value: '3' },
    { label: 'Setup for Browser Extension', value: '4' },
    { label: 'Setup for Capacitor App (Android/iOS)', value: '5' },
  ]);

  if (answer === '1') {
    await setupProject();
  } else if (answer === '2') {
    await setupPlugin();
  } else if (answer === '3') {
    await setupElectron();
  } else if (answer === '4') {
    await setupBrowserExtension();
  } else if (answer === '5') {
    await setupCapacitor();
  }

  // Ask to remove the template scripts directory
  console.log('');
  const removeScripts = await selectOption(
    'Do you want to remove the .templateScripts directory to clean up the project?',
    [
      { label: 'Yes', value: 'y' },
      { label: 'No', value: 'n' },
    ],
  );

  if (removeScripts === 'y') {
    console.log('Removing .templateScripts directory...');
    closeReadline();

    try {
      if (IS_DEBUG) {
        console.log(`[DEBUG] Would remove directory: ${templateScriptsDir}`);
      } else {
        fs.rmSync(templateScriptsDir, { recursive: true, force: true });
        console.log('.templateScripts directory removed.');
      }
    } catch (e) {
      console.error('Failed to remove .templateScripts directory:', e.message);
    }
    return; // Exit
  }

  closeReadline();
}

main();