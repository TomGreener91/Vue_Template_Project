import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const reportPath = path.resolve(rootDir, 'health-report.md');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

// True until `node .templateScripts/setup.cjs` scaffolds and (optionally) removes this directory.
const isBoilerplateMode = fs.existsSync(path.join(rootDir, '.templateScripts'));

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(
    // eslint-disable-next-line no-control-regex -- matches ANSI escape sequences on purpose
    /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  );
};

const cleanNpmBoilerplate = (str) => {
  if (!str) return '';
  const lines = str.split('\n');
  while (lines.length > 0 && (lines[0].trim().startsWith('>') || lines[0].trim() === '')) {
    lines.shift();
  }
  return lines.join('\n').trim();
};

const runCommand = (command) => {
  return new Promise((resolve) => {
    exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        error,
      });
    });
  });
};

const renderBar = (value, max, width = 20) => {
  const ratio = Math.max(0, Math.min(value / max, 1));
  const filled = Math.round(ratio * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
};

const runGitCommand = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

/**
 * Node/npm/OS versions plus boilerplate-vs-scaffolded state, since the latter changes
 * which other findings in this report are expected vs. real problems.
 */
const checkEnvironment = async () => {
  const lines = [];
  let count = 0;

  const nodeMajor = parseInt(process.version.slice(1), 10);
  const requiredNode = pkg.engines?.node ?? '>=20.0.0';
  const requiredNodeMajor = parseInt(requiredNode.replace(/[^\d.]/g, ''), 10);
  const nodeOk = nodeMajor >= requiredNodeMajor;
  if (!nodeOk) count += 1;
  lines.push(
    `Node.js: ${process.version} (requires ${requiredNode}) - ${nodeOk ? 'OK' : 'MISMATCH'}`,
  );

  let npmVersion = 'unknown';
  try {
    npmVersion = execSync('npm --version', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    // npm not resolvable on PATH; leave as 'unknown'
  }
  const requiredNpm = pkg.engines?.npm ?? '>=10.0.0';
  const requiredNpmMajor = parseInt(requiredNpm.replace(/[^\d.]/g, ''), 10);
  const npmMajor = parseInt(npmVersion, 10);
  const npmOk = !Number.isNaN(npmMajor) && npmMajor >= requiredNpmMajor;
  if (!npmOk) count += 1;
  lines.push(`npm: v${npmVersion} (requires ${requiredNpm}) - ${npmOk ? 'OK' : 'MISMATCH'}`);

  lines.push(`Platform: ${process.platform} (${process.arch})`);
  lines.push('');

  if (isBoilerplateMode) {
    lines.push(
      'Boilerplate Mode: `.templateScripts/` is present — this project has not been scaffolded yet.',
    );
    lines.push(
      'Run `node .templateScripts/setup.cjs` to configure it for Project, Plugin, Electron, or Browser Extension development.',
    );
    lines.push(
      'Until then, the following are *expected* to be absent or contain placeholders (not bugs):',
    );
    lines.push('  - `.github/workflows/` (CI/CD workflows are copied in during setup)');
    lines.push('  - `plugins/**` and `csp.config.ts` referenced in tsconfig.json');
    lines.push('  - `{{PLACEHOLDER}}`-style tokens inside `.templateScripts/templates/**`');
  } else {
    lines.push(
      'Boilerplate Mode: `.templateScripts/` was not found — this project has already been scaffolded.',
    );
  }

  return { success: nodeOk && npmOk, stdout: lines.join('\n'), stderr: '', count };
};

/** Uncommitted changes and how far the current branch has drifted from its upstream. */
const checkGitStatus = async () => {
  const lines = [];
  const branch = runGitCommand('rev-parse --abbrev-ref HEAD') ?? 'unknown';
  const statusOutput = runGitCommand('status --porcelain') ?? '';
  const changedFiles = statusOutput ? statusOutput.split('\n').filter(Boolean) : [];
  const count = changedFiles.length;

  lines.push(`Branch: ${branch}`);
  lines.push(`Uncommitted changes: ${count}`);
  if (count > 0) {
    lines.push('', 'Changed files:', ...changedFiles.map((l) => `  ${l}`));
  }

  const upstreamCounts = runGitCommand(`rev-list --left-right --count origin/${branch}...HEAD`);
  if (upstreamCounts) {
    const [behind, ahead] = upstreamCounts.split(/\s+/);
    lines.push(
      '',
      `Ahead of origin/${branch}: ${ahead} commit(s)`,
      `Behind origin/${branch}: ${behind} commit(s)`,
    );
  } else {
    lines.push(
      '',
      `No upstream tracking branch found for '${branch}' (or 'origin' is unreachable).`,
    );
  }

  return { success: count === 0, stdout: lines.join('\n'), stderr: '', count };
};

// Packages only ever referenced by name inside JSON/CSS config (no JS/TS import for depcheck to see).
const DEPCHECK_IGNORES = [
  // Tailwind v4 CSS-first plugins, loaded via `@plugin` in src/assets/main.css
  '@tailwindcss/forms',
  '@tailwindcss/typography',
  'tailwindcss-animate',
  'tailwindcss',
  // semantic-release plugins, referenced by name only in .releaserc.json
  '@semantic-release/changelog',
  '@semantic-release/exec',
  '@semantic-release/git',
  '@semantic-release/npm',
  // stylelint presets, referenced by name only in stylelint.config.js
  'stylelint-config-recommended-vue',
  'stylelint-config-standard',
  'stylelint-config-tailwindcss',
  'stylelint-order',
  'postcss-html',
  // prettier plugin, referenced by name only in .prettierrc.json
  'prettier-plugin-tailwindcss',
  // only used by the Plugin/Library template variants under .templateScripts/templates
  'vite-plugin-dts',
];

/** Flags dependencies that are declared-but-unused or used-but-undeclared. */
const checkDependencyUsage = async () => {
  const depcheck = (await import('depcheck')).default;
  const result = await depcheck(rootDir, {
    ignorePatterns: ['dist', '.templateScripts', 'node_modules'],
    ignoreMatches: DEPCHECK_IGNORES,
  });

  const unused = [...result.dependencies, ...result.devDependencies];
  const missing = Object.keys(result.missing);
  const count = unused.length + missing.length;

  const lines = [];
  if (unused.length) {
    lines.push('Unused dependencies:', ...unused.map((d) => `  - ${d}`));
  }
  if (missing.length) {
    lines.push(
      'Missing dependencies (imported in code, not declared in package.json):',
      ...missing.map(
        (d) => `  - ${d}: ${result.missing[d].map((f) => path.relative(rootDir, f)).join(', ')}`,
      ),
    );
  }
  if (count === 0) {
    lines.push('No unused or missing dependencies detected.');
  }

  return { success: count === 0, stdout: lines.join('\n'), stderr: '', count };
};

/** Runs the production build and flags any output chunk over Vite's 500 kB warning threshold. */
const checkBuildBundleSize = async () => {
  const result = await runCommand('npx vite build');
  const output = `${result.stdout}\n${result.stderr}`;
  const chunkMatches = [
    ...output.matchAll(/^(dist\/\S+)\s+([\d.]+)\s*kB(?:[^\d]*gzip:\s*([\d.]+)\s*kB)?/gm),
  ];
  const chunks = chunkMatches.map((m) => ({
    file: m[1],
    kb: parseFloat(m[2]),
    gzipKb: m[3] ? parseFloat(m[3]) : null,
  }));
  const oversized = chunks.filter((c) => c.file.endsWith('.js') && c.kb > 500);

  const lines = [];
  if (result.success && chunks.length) {
    lines.push('Build output:');
    chunks.forEach((c) => {
      const pct = Math.round((c.kb / 500) * 100);
      lines.push(`  ${c.file} — ${c.kb} kB${c.gzipKb !== null ? ` (gzip: ${c.gzipKb} kB)` : ''}`);
      lines.push(`    ${renderBar(c.kb, 500)} ${pct}% of 500 kB warning threshold`);
    });
    if (oversized.length) {
      lines.push(
        '',
        `${oversized.length} chunk(s) exceed the 500 kB warning threshold:`,
        ...oversized.map((c) => `  - ${c.file} (${c.kb} kB)`),
      );
    }
  } else if (!result.success) {
    lines.push('Build failed:', cleanNpmBoilerplate(stripAnsi(result.stderr || result.stdout)));
  }

  // The build check's only job is to validate the build; don't leave its output on disk.
  fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });

  return { success: result.success, stdout: lines.join('\n'), stderr: '', count: oversized.length };
};

const CONSOLE_CALL_REGEX = /console\.(log|warn|error|debug|info)\(/g;

const walkFiles = (dir, exts, results = []) => {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, exts, results);
    } else if (exts.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
};

/** Checks the project's own conventions from gemini.md: store/service naming and no raw console.*. */
const checkProjectConventions = async () => {
  const violations = [];

  const storesDir = path.join(rootDir, 'src', 'stores');
  for (const file of fs.existsSync(storesDir) ? fs.readdirSync(storesDir) : []) {
    if (file.endsWith('.ts') && !file.endsWith('.store.ts') && file !== 'index.ts') {
      violations.push(`src/stores/${file} — expected \`*.store.ts\` naming`);
    }
  }

  const servicesDir = path.join(rootDir, 'src', 'services');
  for (const file of fs.existsSync(servicesDir) ? fs.readdirSync(servicesDir) : []) {
    if (file.endsWith('.ts') && !file.endsWith('.service.ts') && file !== 'index.ts') {
      violations.push(`src/services/${file} — expected \`*.service.ts\` naming`);
    }
  }

  const loggerPath = path.resolve(rootDir, 'src', 'utils', 'logger.ts');
  for (const file of walkFiles(path.join(rootDir, 'src'), ['.ts', '.vue'])) {
    if (path.resolve(file) === loggerPath) continue;
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(CONSOLE_CALL_REGEX);
    if (matches) {
      violations.push(
        `${path.relative(rootDir, file)} — ${matches.length} raw \`console.*\` call(s); use \`logger\` from \`src/utils/logger.ts\` instead`,
      );
    }
  }

  const lines = violations.length
    ? violations.map((v) => `- ${v}`)
    : ['No naming-convention or console.* usage violations detected.'];

  return {
    success: violations.length === 0,
    stdout: lines.join('\n'),
    stderr: '',
    count: violations.length,
  };
};

const checks = [
  {
    name: 'Environment & Runtime',
    category: 'Project Status',
    description:
      'Confirms Node.js/npm versions and whether this repo is still in boilerplate mode.',
    fixCommand: null,
    allowFail: false,
    type: 'custom',
    alwaysShowOutput: true,
    run: checkEnvironment,
  },
  {
    name: 'Git Working Tree',
    category: 'Project Status',
    description:
      'Reports uncommitted changes and how far the current branch has drifted from origin.',
    fixCommand: null,
    allowFail: true,
    type: 'custom',
    alwaysShowOutput: true,
    run: checkGitStatus,
  },
  {
    name: 'Format Check (Prettier)',
    category: 'Code Quality',
    description: 'Checks if all code files are consistently formatted.',
    fixCommand: 'npm run lint:prettier:fix',
    command: 'npm run lint:prettier',
    allowFail: false,
    parse: (stdout) => stdout.split('\n').filter((l) => l.includes('[warn]')).length,
  },
  {
    name: 'Lint JS/TS (ESLint)',
    category: 'Code Quality',
    description: 'Analyzes JavaScript and TypeScript files for code quality issues.',
    fixCommand: 'npm run lint:eslint:fix',
    command: 'npm run lint:eslint',
    allowFail: false,
    parse: (stdout) => {
      const m = stdout.match(/✖ (\d+) problem/);
      return m ? parseInt(m[1], 10) : 0;
    },
  },
  {
    name: 'Lint Styles (Stylelint)',
    category: 'Code Quality',
    description: 'Analyzes CSS and Vue files for styling quality issues.',
    fixCommand: 'npm run lint:styles:fix',
    command: 'npm run lint:styles',
    allowFail: false,
    parse: (stdout) => {
      const m = stdout.match(/[✖×]\s+(\d+)\s+problem/);
      return m ? parseInt(m[1], 10) : 0;
    },
  },
  {
    name: 'Type Check (Vue TSC)',
    category: 'Code Quality',
    description: 'Strictly type-checks Vue templates and TypeScript files.',
    fixCommand: null,
    command: 'npm run type-check',
    allowFail: false,
    parse: (stdout) => stdout.split('\n').filter((l) => l.toLowerCase().includes('error ')).length,
  },
  {
    name: 'Project Conventions',
    category: 'Code Quality',
    description:
      "Checks store/service file naming and raw console statement usage against the project's own coding standards.",
    fixCommand: null,
    allowFail: true,
    type: 'custom',
    run: checkProjectConventions,
  },
  {
    name: 'Build & Bundle Size',
    category: 'Build',
    description:
      'Runs the production build and flags output chunks over the 500 kB warning threshold.',
    fixCommand: null,
    allowFail: false,
    type: 'custom',
    alwaysShowOutput: true,
    run: checkBuildBundleSize,
  },
  {
    name: 'NPM Audit',
    category: 'Dependencies',
    description: 'Scans project dependencies for known security vulnerabilities.',
    fixCommand: 'npm audit fix',
    command: 'npm run deps:audit',
    allowFail: true,
    parse: (stdout) => {
      const m = stdout.match(/(\d+)\s+vulnerabilities/i);
      return m ? parseInt(m[1], 10) : 0;
    },
  },
  {
    name: 'NPM Outdated',
    category: 'Dependencies',
    description: 'Checks for outdated NPM packages in the project.',
    fixCommand: 'npm update',
    command: 'npm run deps:outdated',
    allowFail: true,
    parse: (stdout) => {
      const lines = stdout
        .trim()
        .split('\n')
        .filter((l) => l.length > 0);
      return lines.length > 0 ? lines.length - 1 : 0;
    },
  },
  {
    name: 'Dependency Usage',
    category: 'Dependencies',
    description:
      'Flags dependencies that are declared but unused, or used but not declared (via depcheck).',
    fixCommand: null,
    allowFail: true,
    type: 'custom',
    run: checkDependencyUsage,
  },
];

const CATEGORY_ORDER = ['Project Status', 'Code Quality', 'Build', 'Dependencies'];
const CATEGORY_EMOJI = {
  'Project Status': '🖥️',
  'Code Quality': '🎨',
  Build: '🏗️',
  Dependencies: '📦',
};

// Shields.io escaping: literal `-` becomes `--` and spaces become `_`, then URL-encode the rest.
// `(`/`)` are also encoded so the badge URL is unambiguous inside a Markdown link destination.
const shieldEncode = (str) =>
  encodeURIComponent(String(str).replace(/-/g, '--').replace(/ /g, '_'))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

const badgeColorForCount = (count) => {
  if (count === 0) return 'brightgreen';
  if (count <= 5) return 'yellow';
  return 'red';
};

const badgeMessageForResult = (res) => {
  if (res.name === 'Environment & Runtime') return res.success ? 'OK' : 'Version Mismatch';
  if (res.name === 'Git Working Tree') {
    return res.count === 0 ? 'Clean' : `${res.count} Uncommitted`;
  }
  if (res.name === 'Build & Bundle Size' && !res.success) return 'Build Failed';
  return res.count === 0 ? 'Passing' : `${res.count} Issue${res.count === 1 ? '' : 's'}`;
};

const badgeColorForResult = (res) => {
  if (res.name === 'Build & Bundle Size' && !res.success) return 'red';
  if (res.name === 'Environment & Runtime') return res.success ? 'brightgreen' : 'red';
  return badgeColorForCount(res.count);
};

const buildBadge = (label, message, color) =>
  `![${label}: ${message}](https://img.shields.io/badge/${shieldEncode(label)}-${shieldEncode(message)}-${color})`;

const buildResultBadge = (res) =>
  buildBadge(res.name, badgeMessageForResult(res), badgeColorForResult(res));

const buildOverallBadge = (results) => {
  const criticalFails = results.filter((r) => !r.success && !r.allowFail).length;
  const warnings = results.filter((r) => !r.success && r.allowFail).length;

  if (criticalFails > 0) {
    return buildBadge('Project Health', `${criticalFails} Failing`, 'red');
  }
  if (warnings > 0) {
    return buildBadge(
      'Project Health',
      `${warnings} Warning${warnings === 1 ? '' : 's'}`,
      'yellow',
    );
  }
  return buildBadge('Project Health', 'All Clear', 'brightgreen');
};

const groupByCategory = (results) => {
  const groups = new Map();
  for (const res of results) {
    const category = res.category ?? 'Other';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(res);
  }
  return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
    category,
    emoji: CATEGORY_EMOJI[category] ?? '📁',
    items: groups.get(category),
  }));
};

const generateMarkdown = (results) => {
  const date = new Date().toLocaleString();
  const categories = groupByCategory(results);

  let md = `# 🏥 Project Health Dashboard\n`;
  md += `*Generated on: ${date}*\n\n`;
  md += `${buildOverallBadge(results)}\n\n`;

  if (isBoilerplateMode) {
    md += `> ⚠️ **Boilerplate Mode Detected** — \`.templateScripts/\` is still present, so this project hasn't been scaffolded yet. `;
    md += `Run \`node .templateScripts/setup.cjs\` to configure it for Project, Plugin, Electron, or Browser Extension development. `;
    md += `Some paths referenced in config/docs (e.g. \`.github/workflows\`, \`plugins/**\`) are expected to be absent or templated until then — see the **Environment & Runtime** check below for details.\n\n`;
  }

  // Summary, grouped by category so related checks are easy to scan together.
  md += `## 📊 Summary\n\n`;

  categories.forEach(({ category, emoji, items }) => {
    md += `#### ${emoji} ${category}\n\n`;
    md += `| Check | Status | Count |\n`;
    md += `| :--- | :--- | :---: |\n`;
    items.forEach((res) => {
      md += `| **${res.name}** | ${buildResultBadge(res)} | ${res.count} |\n`;
    });
    md += `\n`;
  });

  md += `---\n\n`;
  md += `## 📋 Detailed Logs\n\n`;

  categories.forEach(({ category, emoji, items }) => {
    md += `## ${emoji} ${category}\n\n`;

    items.forEach((res) => {
      const icon = res.success ? '✅' : res.allowFail ? '⚠️' : '❌';
      md += `### ${icon} ${res.name}\n\n`;
      md += `*${res.description}*\n\n`;

      if (res.success && res.count === 0 && !res.alwaysShowOutput) {
        md += `*Completed successfully with no issues.*\n\n`;
      } else {
        if (!res.success && res.fixCommand) {
          md += `> 💡 **Recommendation:** Run \`${res.fixCommand}\` to attempt an auto-fix for some of these issues.\n`;
          md += `> *(Note: This command may not be able to automatically fix all errors. Manual intervention may still be required).* \n\n`;
        }

        md += `<details>\n<summary>View Output Log</summary>\n\n`;

        const cleanStdout = cleanNpmBoilerplate(stripAnsi(res.stdout));
        const cleanStderr = cleanNpmBoilerplate(stripAnsi(res.stderr));
        const combinedOutput = (cleanStdout + '\n' + cleanStderr).trim();

        if (res.name.includes('Prettier') && combinedOutput) {
          const warnLines = combinedOutput.split('\n').filter((l) => l.includes('[warn]'));
          const errorLines = combinedOutput.split('\n').filter((l) => l.includes('[error]'));

          if (warnLines.length > 0) {
            md += `#### Unformatted Files\n`;
            warnLines.forEach((l) => {
              md += `- \`${l.replace('[warn]', '').trim()}\`\n`;
            });
            md += `\n`;
          }

          if (errorLines.length > 0) {
            md += `#### Syntax Errors\n`;
            md += `\`\`\`text\n${errorLines.join('\n')}\n\`\`\`\n\n`;
          }

          if (warnLines.length === 0 && errorLines.length === 0) {
            md += `#### Output\n\`\`\`text\n${combinedOutput}\n\`\`\`\n\n`;
          }
        } else {
          if (cleanStdout) {
            md += `#### Output\n`;
            md += `\`\`\`text\n${cleanStdout}\n\`\`\`\n\n`;
          }

          if (cleanStderr) {
            md += `#### Error Log\n`;
            md += `\`\`\`text\n${cleanStderr}\n\`\`\`\n\n`;
          }
        }

        md += `</details>\n\n`;
      }
    });
  });

  return md;
};

const main = async () => {
  console.log('🏥 Starting Local Health Checks...\n');
  const results = [];

  for (const check of checks) {
    console.log(`⏳ Running: ${check.name}...`);
    const result = check.type === 'custom' ? await check.run() : await runCommand(check.command);

    const count =
      check.type === 'custom' ? result.count : check.parse(`${result.stdout}\n${result.stderr}`);

    results.push({ ...check, ...result, count });

    if (result.success) {
      console.log(`  ✅ Passed (Found ${count} issues)\n`);
    } else {
      console.log(`  ${check.allowFail ? '⚠️ Warned' : '❌ Failed'} (Found ${count} issues)\n`);
    }
  }

  console.log('📝 Generating health-report.md...');
  const mdContent = generateMarkdown(results);
  fs.writeFileSync(reportPath, mdContent, 'utf8');

  console.log(`\n🎉 Done! Open 'health-report.md' in your IDE to view the dashboard.`);
};

main().catch(console.error);
