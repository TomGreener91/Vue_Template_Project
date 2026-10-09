const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const pluginsDir = path.join(__dirname, '..', 'plugins');
const templatesDir = path.join(__dirname, 'templates');
const templateScriptsDir = __dirname;
const projectRoot = path.join(__dirname, '..');

// Check for debug flag in command line arguments
const IS_DEBUG = process.argv.includes('--debug');

/**
 * Pre-supplied answers from the command line, e.g. --type=project --cleanup=y.
 * Any prompt with a matching flag is answered automatically, so the script can run
 * non-interactively (CI, AI agents). Prompts without a flag fall back to interactive input.
 * @type {Record<string, string>}
 */
const ARGS = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    ARGS[match[1]] = match[2];
  }
}

/**
 * Exits with a clear error when a prompt needs input but no terminal is attached.
 * Prevents agents/CI from hanging on a prompt they cannot answer.
 * @param {string} flag The flag that would answer this prompt
 * @param {string} hint Description of accepted values
 */
function exitMissingFlag(flag, hint) {
  console.error(`\nNon-interactive shell detected. Pass --${flag}=${hint} to answer this prompt.`);
  process.exit(1);
}

/**
 * Prompts the user with a question and waits for input.
 * If `flag` is given and supplied on the command line, its value is used instead.
 * @param {string} query The question to display
 * @param {string} [flag] Command-line flag name that can answer this prompt
 * @returns {Promise<string>} User's response
 */
function askQuestion(query, flag) {
  if (flag && ARGS[flag] !== undefined) {
    console.log(`${query}${ARGS[flag]} (from --${flag})`);
    return Promise.resolve(ARGS[flag]);
  }

  if (flag && !process.stdin.isTTY) {
    exitMissingFlag(flag, '<value>');
  }

  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Prompts the user with a list of options using an interactive selector.
 * If `flag` is given and supplied on the command line, the matching option is used instead.
 * @param {string} message The prompt message
 * @param {Array<{label: string, value: string}>} options Array of options to select
 * @param {string} [flag] Command-line flag name that can answer this prompt
 * @returns {Promise<string>} The value of the selected option
 */
async function selectOption(message, options, flag) {
  const validValues = options.map((opt) => opt.value);

  if (flag && ARGS[flag] !== undefined) {
    const chosen = options.find((opt) => opt.value === ARGS[flag]);
    if (!chosen) {
      console.error(`Invalid --${flag}=${ARGS[flag]}. Valid values: ${validValues.join(', ')}`);
      process.exit(1);
    }
    console.log(`\x1b[1m? ${message}\x1b[0m ${chosen.label} (from --${flag})`);
    return chosen.value;
  }

  if (flag && !process.stdin.isTTY) {
    exitMissingFlag(flag, `<${validValues.join('|')}>`);
  }

  return new Promise((resolve) => {
    let selectedIndex = 0;

    // Use bold for the prompt message
    console.log(`\x1b[1m? ${message}\x1b[0m`);
    options.forEach(() => console.log());

    const render = () => {
      process.stdout.write(`\x1B[${options.length}A`);

      options.forEach((opt, idx) => {
        process.stdout.write('\x1B[2K\x1B[G');
        if (idx === selectedIndex) {
          // Cyan pointer and bold text for selected option
          console.log(`  \x1b[36m❯ ${opt.label}\x1b[0m`);
        } else {
          // Dim text for unselected option
          console.log(`    \x1b[2m${opt.label}\x1b[0m`);
        }
      });
    };

    render();

    const onKeypress = (str, key) => {
      if (key.name === 'up') {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
        render();
      } else if (key.name === 'down') {
        selectedIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(options[selectedIndex].value);
      } else if (key.name === 'c' && key.ctrl) {
        cleanup();
        process.exit(1);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Extracts the base name from a package name, ignoring scopes.
 * @param {string} str The full package name
 * @returns {string} The base name
 */
function getBaseName(str) {
  // If scoped package (e.g. @scope/name), take only the 'name' part
  const parts = str.split('/');
  const name = parts[parts.length - 1];
  // Remove @ if it's there (should be handled by split, but just in case)
  return name.replace(/^@/, '');
}

/**
 * Converts a string to PascalCase (e.g. my-plugin -> MyPlugin).
 * @param {string} str Input string
 * @returns {string} PascalCase string
 */
function toPascalCase(str) {
  const base = getBaseName(str);
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Converts a string to camelCase (e.g. my-plugin -> myPlugin).
 * @param {string} str Input string
 * @returns {string} camelCase string
 */
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Recursively copies a directory, applying string replacements to file contents and specific filenames.
 * @param {string} source Source directory path
 * @param {string} target Target directory path
 * @param {Record<string, string>} replacements Key-value pairs for string replacements
 */
function copyDirectoryRecursive(source, target, replacements) {
  if (!fs.existsSync(target)) {
    if (IS_DEBUG) {
      console.log(`[DEBUG] Would create directory: ${target}`);
    } else {
      fs.mkdirSync(target, { recursive: true });
    }
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);

    let destName = entry.name;
    if (destName === 'Component.vue' && replacements['{{PASCAL_PLUGIN_NAME}}']) {
      destName = `${replacements['{{PASCAL_PLUGIN_NAME}}']}Component.vue`;
    }

    const destPath = path.join(target, destName);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, replacements);
    } else {
      let content = fs.readFileSync(srcPath, 'utf-8');

      for (const [key, value] of Object.entries(replacements)) {
        content = content.split(key).join(value);
      }

      if (IS_DEBUG) {
        console.log(`[DEBUG] Would write file: ${destPath}`);
      } else {
        fs.writeFileSync(destPath, content);
      }
    }
  }
}

function closeReadline() {
  rl.close();
}

/**
 * Safely updates the scripts section of the root package.json file.
 * @param {Record<string, string>} newScripts Scripts to merge or overwrite
 */
function updateRootPackageScripts(newScripts) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageJson.scripts = packageJson.scripts || {};

      let changed = false;
      for (const [key, value] of Object.entries(newScripts)) {
        if (packageJson.scripts[key] !== value) {
          packageJson.scripts[key] = value;
          changed = true;
        }
      }

      if (changed) {
        if (IS_DEBUG) {
          console.log(`[DEBUG] Would update root package.json scripts with:`, newScripts);
        } else {
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          console.log('Updated root package.json scripts.');
        }
      }
    } catch (e) {
      console.error('Failed to update root package.json scripts:', e.message);
    }
  }
}

/**
 * Copies a specific composite action from .templateScripts to .github/actions.
 * @param {string} actionName Directory name of the action (e.g. 'setup-node-build')
 */
function copyCompositeAction(actionName) {
  const actionSrcDir = path.join(templateScriptsDir, 'workflows', 'actions', actionName);
  const actionDestDir = path.join(projectRoot, '.github', 'actions', actionName);

  if (fs.existsSync(actionSrcDir)) {
    copyDirectoryRecursive(actionSrcDir, actionDestDir, {});
    console.log(`Copied ${actionName} composite action.`);
  }
}

/**
 * Copies and configures the single unified ci-cd.yml workflow with the chosen deploy job.
 * @param {string} [deployJobYaml] The YAML snippet for the deployment job(s)
 * @param {Record<string, string>} [replacements] Additional placeholder replacements
 */
async function setupPipelineWorkflow(deployJobYaml = '', replacements = {}) {
  const workflowDestDir = path.join(projectRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowDestDir)) {
    if (!IS_DEBUG) fs.mkdirSync(workflowDestDir, { recursive: true });
  }

  const pipelineSrc = path.join(templateScriptsDir, 'workflows', 'ci-cd.yml');
  const pipelineDest = path.join(workflowDestDir, 'ci-cd.yml');

  let content = '';
  if (fs.existsSync(pipelineSrc)) {
    content = fs.readFileSync(pipelineSrc, 'utf-8');
  }

  if (content) {
    // Replace the {{DEPLOY_JOBS}} placeholder
    content = content.replace('{{DEPLOY_JOBS}}', deployJobYaml ? `\n${deployJobYaml}` : '');

    // Apply any additional replacements
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }

    if (IS_DEBUG) {
      console.log(`[DEBUG] Would write ci-cd.yml to ${pipelineDest}`);
    } else {
      fs.writeFileSync(pipelineDest, content);
      console.log('Configured unified ci-cd.yml GitHub Actions workflow.');
    }
  }
}

module.exports = {
  pluginsDir,
  templatesDir,
  templateScriptsDir,
  projectRoot,
  IS_DEBUG,
  ARGS,
  askQuestion,
  selectOption,
  closeReadline,
  toPascalCase,
  toCamelCase,
  copyDirectoryRecursive,
  updateRootPackageScripts,
  copyCompositeAction,
  setupPipelineWorkflow
};
