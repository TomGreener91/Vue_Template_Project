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
  copyCompositeAction,
  setupPipelineWorkflow
} = require('../utils.cjs');

/**
 * Updates the workspaces array in the root package.json to include the plugins directory.
 */
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

/**
 * Automatically injects the new plugin into the main Vue application's main.ts file.
 * @param {string} pluginName The package name of the plugin
 * @param {string} importName The variable name to import the plugin as
 * @param {boolean} defaultExport Whether the plugin uses a default export
 */
function addPluginToMainTs(pluginName, importName, defaultExport = true) {
  const mainTsPath = path.join(projectRoot, 'src', 'main.ts');
  if (!fs.existsSync(mainTsPath)) return;

  let content = fs.readFileSync(mainTsPath, 'utf-8');

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

/**
 * Orchestrates the creation of a new plugin, components library, or utility package.
 * Handles templating, workflows, and workspace injection.
 */
async function setupPlugin() {
  console.log('\nSetting up for Plugin Development...');

  const pluginName = await askQuestion('Enter the name of your new plugin (kebab-case): ');

  if (!pluginName) {
    console.log('Plugin name is required.');
    return;
  }

  // Ask for plugin type
  console.log('');
  const pluginType = await selectOption('What type of package are you creating?', [
    { label: 'Vue Component Library (UI Components)', value: 'component-library' },
    { label: 'Vue App Plugin (Provides app.use() install hook)', value: 'vue-plugin' },
    { label: 'Standard Code/Utils Library (No Vue dependency)', value: 'utils-library' },
    { label: 'Vite Plugin (Build tool extension)', value: 'vite-plugin' },
  ]);

  const templateName = pluginType;

  console.log('');
  const deployDocs = await selectOption(
    'Do you want to deploy documentation to GitHub Pages when publishing this plugin?',
    [
      { label: 'Yes', value: 'y' },
      { label: 'No', value: 'n' },
    ],
  );

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
  
  // Inject shared docs if the user wants them
  if (deployDocs === 'y') {
    const sharedDocsSrc = path.join(__dirname, '..', 'shared', 'docs');
    const pluginDocsDest = path.join(newPluginDir, 'docs');
    
    if (fs.existsSync(sharedDocsSrc)) {
      copyDirectoryRecursive(sharedDocsSrc, pluginDocsDest, replacements);
      console.log('Injected shared VitePress documentation setup.');
      
      const pluginPkgPath = path.join(newPluginDir, 'package.json');
      if (fs.existsSync(pluginPkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pluginPkgPath, 'utf-8'));
          pkg.devDependencies = pkg.devDependencies || {};
          pkg.devDependencies['vitepress'] = '^3.5.0';
          
          pkg.scripts = pkg.scripts || {};
          pkg.scripts['docs:dev'] = 'vitepress dev docs';
          pkg.scripts['docs:build'] = 'vitepress build docs';
          
          fs.writeFileSync(pluginPkgPath, JSON.stringify(pkg, null, 2));
          console.log('Updated plugin package.json with VitePress scripts and dependencies.');
        } catch (e) {
          console.error('Failed to update plugin package.json for docs:', e.message);
        }
      }
    }
  }

  // Copy composite actions needed for plugin release
  copyCompositeAction('setup-node-build');
  copyCompositeAction('publish-npm');
  if (deployDocs === 'y') {
    copyCompositeAction('deploy-github-pages');
  }

  // Define the publish job YAML
  const deployJobYaml = `  publish-npm:
    name: Publish NPM Package
    needs: release
    if: needs.release.outputs.new_release_published == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: v\${{ needs.release.outputs.new_release_version }}

      - name: Setup Node and Build
        uses: ./.github/actions/setup-node-build
        with:
          build-command: 'npm run build'
          registry-url: 'https://registry.npmjs.org'

      - name: Publish Package & Docs
        uses: ./.github/actions/publish-npm
        with:
          npm-token: \${{ secrets.NPM_TOKEN }}
          workspace-path: 'plugins/{{PLUGIN_NAME}}'
          version: \${{ needs.release.outputs.new_release_version }}
          deploy-docs: '{{DEPLOY_DOCS}}'
          docs-build-command: 'npm run docs:build --workspace plugins/{{PLUGIN_NAME}} --if-present'
          docs-dist-path: './plugins/{{PLUGIN_NAME}}/docs/.vitepress/dist'`;

  // Set up the unified pipeline workflow
  await setupPipelineWorkflow(deployJobYaml, {
    '{{PLUGIN_NAME}}': pluginName,
    '{{DEPLOY_DOCS}}': deployDocs === 'y' ? 'true' : 'false'
  });

  console.log(`Plugin "${pluginName}" created at plugins/${pluginName}`);

  // Automatically update workspaces in package.json
  updateWorkspaces();

  // Update .releaserc.json with the plugin name
  const releasercPath = path.join(projectRoot, '.releaserc.json');
  if (fs.existsSync(releasercPath)) {
    try {
      if (IS_DEBUG) {
        console.log(`[DEBUG] Would update .releaserc.json with plugin name: ${pluginName}`);
      } else {
        let content = fs.readFileSync(releasercPath, 'utf-8');
        content = content.replace(/\{\{PLUGIN_NAME\}\}/g, pluginName);
        fs.writeFileSync(releasercPath, content);
        console.log(`Updated .releaserc.json with plugin name: ${pluginName}`);
      }
    } catch (e) {
      console.error('Failed to update .releaserc.json:', e.message);
    }
  }

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
        { label: 'No', value: 'n' },
      ],
    );
    if (addToMain === 'y') {
      const pascalName = toPascalCase(pluginName);
      if (pluginType === 'vue-plugin') {
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