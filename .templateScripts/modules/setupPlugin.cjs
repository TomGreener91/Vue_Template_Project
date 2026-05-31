const fs = require('fs');
const path = require('path');
const {
  pluginsDir,
  templatesDir,
  projectRoot,
  IS_DEBUG,
  askQuestion,
  selectOption,
  toPascalCase,
  toCamelCase,
  copyDirectoryRecursive,
  updateRootPackageScripts,
  setupReleaseWorkflow
} = require('../utils.cjs');

function updateWorkspaces() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      if (!packageJson.workspaces) {
        packageJson.workspaces = [];
      }

      const pluginPattern = 'plugins/**/*';

      if (!packageJson.workspaces.includes(pluginPattern)) {
        packageJson.workspaces.push(pluginPattern);

        if (IS_DEBUG) {
          console.log(`[DEBUG] Would add "${pluginPattern}" to workspaces in package.json`);
        } else {
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          console.log(`Updated package.json workspaces to include plugins.`);
        }
      }
    } catch (e) {
      console.error('Failed to update package.json workspaces:', e.message);
    }
  }
}

function addPluginToMainTs(pluginName, importName, defaultExport = true) {
  const mainTsPath = path.join(projectRoot, 'src', 'main.ts');
  if (!fs.existsSync(mainTsPath)) return;

  let content = fs.readFileSync(mainTsPath, 'utf-8');

  // If standard plugin or component library, we might use default import
  const importStatement = defaultExport 
    ? `import ${importName} from '${pluginName}'\n`
    : `import { ${importName} } from '${pluginName}'\n`;

  const lastImportIndex = content.lastIndexOf('import ');
  const endOfLastImport = content.indexOf('\n', lastImportIndex);

  content =
    content.slice(0, endOfLastImport + 1) + importStatement + content.slice(endOfLastImport + 1);

  const mountIndex = content.indexOf('app.mount');
  content = content.slice(0, mountIndex) + `app.use(${importName})\n` + content.slice(mountIndex);

  if (IS_DEBUG) {
    console.log(`[DEBUG] Would update src/main.ts to include plugin: ${pluginName}`);
  } else {
    fs.writeFileSync(mainTsPath, content);
    console.log(`Added ${pluginName} to src/main.ts`);
  }
}

async function setupPlugin() {
  console.log('\nSetting up for Plugin Development...');

  const pluginName = await askQuestion('Enter the name of your new plugin (kebab-case): ');

  if (!pluginName) {
    console.log('Plugin name is required.');
    return;
  }

  // Ask for plugin type
  console.log('');
  let pluginType = await selectOption('What type of package are you creating?', [
    { label: 'Vue Component Library (UI Components)', value: 'component-library' },
    { label: 'Vue App Plugin (Provides app.use() install hook)', value: 'vue-plugin' },
    { label: 'Standard Code/Utils Library (No Vue dependency)', value: 'utils-library' },
    { label: 'Vite Plugin (Build tool extension)', value: 'vite-plugin' },
  ]);

  let templateName = pluginType;

  const newPluginDir = path.join(pluginsDir, pluginName);

  if (fs.existsSync(newPluginDir)) {
    console.log(`Plugin "${pluginName}" already exists.`);
    return;
  }

  console.log(`Creating plugin from template: ${templateName}`);

  const selectedTemplateDir = path.join(templatesDir, templateName);

  if (!fs.existsSync(selectedTemplateDir)) {
    console.error(`Error: Template "${templateName}" not found at ${selectedTemplateDir}`);
    return;
  }

  // Variables for replacement
  const replacements = {
    '{{PLUGIN_NAME}}': pluginName,
    '{{PASCAL_PLUGIN_NAME}}': toPascalCase(pluginName),
    '{{CAMEL_PLUGIN_NAME}}': toCamelCase(pluginName),
  };

  copyDirectoryRecursive(selectedTemplateDir, newPluginDir, replacements);
  
  // Handle workflow copying for non-NPM plugins (e.g., Browser Extensions, Electron)
  const workflowSrcDir = path.join(newPluginDir, '.github', 'workflows');
  const rootWorkflowDestDir = path.join(projectRoot, '.github', 'workflows');

  if (fs.existsSync(workflowSrcDir)) {
      if (!fs.existsSync(rootWorkflowDestDir)) {
         if (!IS_DEBUG) fs.mkdirSync(rootWorkflowDestDir, { recursive: true });
      }

      const files = fs.readdirSync(workflowSrcDir);
      for (const file of files) {
          const srcFile = path.join(workflowSrcDir, file);
          const destFile = path.join(rootWorkflowDestDir, file);
          
          if (!fs.existsSync(destFile)) {
              if (IS_DEBUG) {
                  console.log(`[DEBUG] Would copy ${file} to ${destFile}`);
              } else {
                  fs.copyFileSync(srcFile, destFile);
                  console.log(`Copied ${file} GitHub Actions workflow.`);
              }
          } else {
              console.log(`Workflow ${file} already exists at root, skipping copy.`);
          }
      }
      
      // Remove the .github directory from the plugin folder since it doesn't belong there
      if (!IS_DEBUG) {
          fs.rmSync(path.join(newPluginDir, '.github'), { recursive: true, force: true });
      } else {
           console.log(`[DEBUG] Would remove .github from plugin directory ${newPluginDir}`);
      }
  }

  // Dynamically generate the wrapper workflow for publishing this specific plugin
  const targetPublishWorkflow = path.join(rootWorkflowDestDir, `publish-${pluginName}.yml`);
  if (!fs.existsSync(targetPublishWorkflow)) {
    const wrapperContent = `name: Publish ${toPascalCase(pluginName)}

on:
  workflow_call:
    inputs:
      version:
        description: 'The version being published'
        required: true
        type: string
    secrets:
      NPM_TOKEN:
        required: true

jobs:
  call-publish-workflow:
    uses: ./.github/workflows/publish-plugin.yml
    with:
      version: \${{ inputs.version }}
      plugin_name: '${pluginName}'
    secrets:
      NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would write publish-${pluginName}.yml wrapper to ${targetPublishWorkflow}`);
    } else {
      fs.writeFileSync(targetPublishWorkflow, wrapperContent);
      console.log(`Generated wrapper workflow for publishing plugin: ${pluginName}`);
    }
  } else {
    console.log(`Workflow publish-${pluginName}.yml already exists at root, skipping generation.`);
  }

  // Ensure standard CI workflow is copied if setting up the first plugin
  const ciWorkflowSrc = path.join(__dirname, '..', 'workflows', 'ci.yml');
  const ciWorkflowDest = path.join(rootWorkflowDestDir, 'ci.yml');

  if (fs.existsSync(ciWorkflowSrc) && !fs.existsSync(ciWorkflowDest)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy ci.yml to ${ciWorkflowDest}`);
    } else {
      fs.copyFileSync(ciWorkflowSrc, ciWorkflowDest);
      console.log('Copied standard CI GitHub Actions workflow.');
    }
  }

  // Ensure the reusable publish-plugin workflow is copied
  const publishWorkflowSrc = path.join(__dirname, '..', 'workflows', 'publish-plugin.yml');
  const publishWorkflowDest = path.join(rootWorkflowDestDir, 'publish-plugin.yml');
  if (fs.existsSync(publishWorkflowSrc) && !fs.existsSync(publishWorkflowDest)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy publish-plugin.yml to ${publishWorkflowDest}`);
    } else {
      fs.copyFileSync(publishWorkflowSrc, publishWorkflowDest);
      console.log('Copied reusable publish-plugin workflow.');
    }
  }

  // Ensure the composite action exists since publish-plugins uses it
  const actionsDestDir = path.join(projectRoot, '.github', 'actions', 'setup-node-build');
  if (!fs.existsSync(actionsDestDir)) {
    if (!IS_DEBUG) fs.mkdirSync(actionsDestDir, { recursive: true });
  }

  const actionSrc = path.join(__dirname, '..', 'workflows', 'actions', 'setup-node-build', 'action.yml');
  const actionDest = path.join(actionsDestDir, 'action.yml');
  if (fs.existsSync(actionSrc) && !fs.existsSync(actionDest)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would copy action.yml to ${actionDest}`);
    } else {
      fs.copyFileSync(actionSrc, actionDest);
      console.log('Copied setup-node-build composite action.');
    }
  }

  // Copy standard release workflow and pass the pluginName to link the wrapper correctly
  await setupReleaseWorkflow(pluginName);

  console.log('');
  const deployDocs = await selectOption(
    'Do you want to deploy documentation to GitHub Pages when publishing this plugin?',
    [
      { label: 'Yes', value: 'y' },
      { label: 'No', value: 'n' },
    ],
  );

  if (deployDocs === 'y') {
    const docsWorkflowSrc = path.join(__dirname, '..', 'workflows', 'deploy-docs.yml');
    const docsWorkflowDest = path.join(rootWorkflowDestDir, 'deploy-docs.yml');

    if (fs.existsSync(docsWorkflowSrc) && !fs.existsSync(docsWorkflowDest)) {
      if (IS_DEBUG) {
        console.log(`[DEBUG] Would copy deploy-docs.yml to ${docsWorkflowDest}`);
      } else {
        fs.copyFileSync(docsWorkflowSrc, docsWorkflowDest);
        console.log('Copied deploy-docs standalone workflow.');
      }
    }
  }

  console.log(`Plugin "${pluginName}" created at plugins/${pluginName}`);

  // Automatically update workspaces in package.json
  updateWorkspaces();

  // Ensure root build script can handle workspaces, building workspaces FIRST
  updateRootPackageScripts({
    "build:app": "vue-tsc --noEmit && vite build",
    "build:workspaces": "npm run build --workspaces --if-present",
    "build": "npm run build:workspaces && npm run build:app",
    "publish:test": "npm run publish:test --workspaces --if-present"
  });

  if (pluginType === 'component-library' || pluginType === 'vue-plugin') {
    console.log('');
    const addToMain = await selectOption(
      'Do you want to automatically add this plugin to main.ts using app.use()?',
      [
        { label: 'Yes', value: 'y' },
        { label: 'No', 'value': 'n' },
      ],
    );
    if (addToMain === 'y') {
      const pascalName = toPascalCase(pluginName);
      if (pluginType === 'vue-plugin') {
        // Vue plugins might export a specific named object or default
        addPluginToMainTs(pluginName, `${pascalName}Plugin`, true);
      } else {
        addPluginToMainTs(pluginName, `${pascalName}Plugin`, true);
      }
    }
  }

  console.log(
    '\n\x1b[32m%s\x1b[0m',
    'Setup complete! Please run `npm install` to link the new workspace.',
  );
}

module.exports = setupPlugin;