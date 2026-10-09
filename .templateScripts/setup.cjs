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

/*
 * Non-interactive usage (CI / AI agents) — every prompt can be answered by a flag:
 *   --type=project|plugin|electron|extension
 *   --hosting=github-pages|firebase|azure|none           (project)
 *   --name=<kebab-case>                                  (plugin)
 *   --plugin-type=component-library|vue-plugin|utils-library|vite-plugin  (plugin)
 *   --docs=y|n                                           (plugin)
 *   --add-to-main=y|n                     (plugin: component-library / vue-plugin)
 *   --cleanup=y|n
 *   --debug                                              (dry run, no files written)
 *
 * Example:
 *   node .templateScripts/setup.cjs --type=project --hosting=none --cleanup=y
 */

async function main() {
  console.log('Welcome to the Template Setup Script!\n');

  const answer = await selectOption(
    'Select an option:',
    [
      { label: 'Setup for Project Development (Main App)', value: 'project' },
      { label: 'Setup for Plugin Development', value: 'plugin' },
      { label: 'Setup for Electron App', value: 'electron' },
      { label: 'Setup for Browser Extension', value: 'extension' },
    ],
    'type',
  );

  if (answer === 'project') {
    await setupProject();
  } else if (answer === 'plugin') {
    await setupPlugin();
  } else if (answer === 'electron') {
    await setupElectron();
  } else if (answer === 'extension') {
    await setupBrowserExtension();
  }

  // Ask to remove the template scripts directory
  console.log('');
  const removeScripts = await selectOption(
    'Do you want to remove the .templateScripts directory to clean up the project?',
    [
      { label: 'Yes', value: 'y' },
      { label: 'No', value: 'n' },
    ],
    'cleanup',
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
