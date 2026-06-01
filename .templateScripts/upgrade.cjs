const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      // Don't copy node_modules or dist by accident
      if (['node_modules', 'dist', '.git'].includes(childItemName)) return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('\x1b[31mError: Please provide the path to the legacy project you want to upgrade.\x1b[0m');
  console.log('Usage: node .templateScripts/upgrade.cjs ../legacy-project');
  process.exit(1);
}

const targetPath = path.resolve(process.cwd(), args[0]);
const sourcePath = path.resolve(__dirname, '..');

if (!fs.existsSync(targetPath)) {
  console.error(`\x1b[31mError: Target directory "${targetPath}" does not exist.\x1b[0m`);
  process.exit(1);
}

const targetPkgPath = path.join(targetPath, 'package.json');
if (!fs.existsSync(targetPkgPath)) {
  console.error(`\x1b[31mError: Target directory does not seem to be a Node project (no package.json found).\x1b[0m`);
  process.exit(1);
}

console.log(`\n\x1b[36mStarting Retroactive Upgrade for: ${targetPath}\x1b[0m\n`);

// 1. Copy Configurations
const configFiles = [
  'eslint.config.js',
  'stylelint.config.js',
  '.prettierrc.json',
  '.prettierignore',
  'tsconfig.json',
  'vite.config.ts',
  'csp.config.ts',
  '.releaserc.json',
  '.gitignore'
];

console.log('Copying configuration files...');
configFiles.forEach(file => {
  const src = path.join(sourcePath, file);
  const dest = path.join(targetPath, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  - Copied ${file}`);
  }
});

// 2. Copy Infrastructure Directories
console.log('\nPurging old .github workflows and injecting new template engine...');

// Destroy old .github directory to enforce a clean slate for new workflows
const targetGithubDir = path.join(targetPath, '.github');
if (fs.existsSync(targetGithubDir)) {
  fs.rmSync(targetGithubDir, { recursive: true, force: true });
  console.log('  - Purged old .github/ directory');
}

const dirsToCopy = ['.templateScripts'];
dirsToCopy.forEach(dir => {
  const src = path.join(sourcePath, dir);
  const dest = path.join(targetPath, dir);
  if (fs.existsSync(src)) {
    copyRecursiveSync(src, dest);
    console.log(`  - Copied ${dir}/ deeply`);
  }
});

// 3. Update Package.json
console.log('\nMerging package.json configurations...');
const sourcePkg = JSON.parse(fs.readFileSync(path.join(sourcePath, 'package.json'), 'utf8'));
const targetPkg = JSON.parse(fs.readFileSync(targetPkgPath, 'utf8'));

// Enforce modern Node module
targetPkg.type = 'module';

// Merge Scripts
targetPkg.scripts = targetPkg.scripts || {};
targetPkg.scripts = {
  ...targetPkg.scripts,
  "dev": sourcePkg.scripts.dev,
  "build": sourcePkg.scripts.build,
  "preview": sourcePkg.scripts.preview,
  "lint": sourcePkg.scripts.lint,
  "lint:fix": sourcePkg.scripts.lint[':fix'] || sourcePkg.scripts['lint:fix'],
  "lint:styles": sourcePkg.scripts['lint:styles'],
  "lint:styles:fix": sourcePkg.scripts['lint:styles:fix'],
  "format": sourcePkg.scripts.format,
  "type-check": sourcePkg.scripts['type-check'],
  "release": sourcePkg.scripts.release,
};

// Merge DevDependencies
targetPkg.devDependencies = targetPkg.devDependencies || {};
Object.keys(sourcePkg.devDependencies).forEach(dep => {
  targetPkg.devDependencies[dep] = sourcePkg.devDependencies[dep];
});

// Ensure workspaces array is setup for plugins
targetPkg.workspaces = targetPkg.workspaces || [];
if (!targetPkg.workspaces.includes('plugins/*')) {
  targetPkg.workspaces.push('plugins/*');
}

fs.writeFileSync(targetPkgPath, JSON.stringify(targetPkg, null, 2));
console.log('  - Updated package.json with scripts, type: module, and workspaces.');
console.log('  - Injected latest devDependencies.');

// Done
console.log(`\n\x1b[32mInfrastructure Injection Complete!\x1b[0m\n`);
console.log('\x1b[36mRunning Interactive Setup to configure your CI/CD pipelines...\x1b[0m\n');

try {
  execSync('node .templateScripts/setup.cjs', { stdio: 'inherit', cwd: targetPath });
} catch (e) {
  console.error('\x1b[31mInteractive setup was interrupted or failed.\x1b[0m');
}

console.log(`\n\x1b[32mUpgrade Fully Completed!\x1b[0m\n`);
console.log('Next Steps:');
console.log(`1. cd into ${args[0]}`);
console.log('2. Run \x1b[33mnpm install\x1b[0m to install all the new tooling.');
console.log('3. Run \x1b[33mnpm run format\x1b[0m and \x1b[33mnpm run lint:fix\x1b[0m to auto-align your old code to the new standards.');
console.log('\nNote: Your src/ folder was left completely untouched. You may need to manually update Tailwind 4 classes in your code if you upgraded from v3.');
