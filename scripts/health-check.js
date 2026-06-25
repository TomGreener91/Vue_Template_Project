import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const reportPath = path.resolve(rootDir, 'health-report.md');

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
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

const checks = [
  { 
    name: 'Format Check (Prettier)', 
    description: 'Checks if all code files are consistently formatted.',
    fixCommand: 'npm run lint:prettier:fix',
    command: 'npm run lint:prettier', 
    allowFail: false,
    parse: (stdout) => stdout.split('\n').filter(l => l.includes('[warn]')).length
  },
  { 
    name: 'Lint JS/TS (ESLint)', 
    description: 'Analyzes JavaScript and TypeScript files for code quality issues.',
    fixCommand: 'npm run lint:eslint:fix',
    command: 'npm run lint:eslint', 
    allowFail: false,
    parse: (stdout) => { const m = stdout.match(/✖ (\d+) problem/); return m ? parseInt(m[1], 10) : 0; }
  },
  { 
    name: 'Lint Styles (Stylelint)', 
    description: 'Analyzes CSS and Vue files for styling quality issues.',
    fixCommand: 'npm run lint:styles:fix',
    command: 'npm run lint:styles', 
    allowFail: false,
    parse: (stdout) => { const m = stdout.match(/✖\s+(\d+)\s+problem/); return m ? parseInt(m[1], 10) : 0; }
  },
  { 
    name: 'Type Check (Vue TSC)', 
    description: 'Strictly type-checks Vue templates and TypeScript files.',
    fixCommand: null,
    command: 'npm run type-check', 
    allowFail: false,
    parse: (stdout) => stdout.split('\n').filter(l => l.toLowerCase().includes('error ')).length
  },
  { 
    name: 'NPM Audit', 
    description: 'Scans project dependencies for known security vulnerabilities.',
    fixCommand: 'npm audit fix',
    command: 'npm run check:audit', 
    allowFail: true,
    parse: (stdout) => { const m = stdout.match(/(\d+)\s+vulnerabilities/i); return m ? parseInt(m[1], 10) : 0; }
  },
  { 
    name: 'NPM Outdated', 
    description: 'Checks for outdated NPM packages in the project.',
    fixCommand: 'npm update',
    command: 'npm run check:outdated', 
    allowFail: true,
    parse: (stdout) => { const lines = stdout.trim().split('\n').filter(l => l.length > 0); return lines.length > 0 ? lines.length - 1 : 0; }
  },
];

const getHealthIcon = (count) => {
  if (count === 0) return '🟢';
  if (count >= 1 && count <= 5) return '🟡';
  return '🔴';
};

const runCommand = (command) => {
  return new Promise((resolve) => {
    exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        error
      });
    });
  });
};

const generateMarkdown = (results) => {
  const date = new Date().toLocaleString();
  
  let md = `# 🏥 Project Health Dashboard\n`;
  md += `*Generated on: ${date}*\n\n`;

  // Metrics Chart
  md += `## 📈 Health Metrics Chart\n\n`;
  md += `| Metric | Count | Health |\n`;
  md += `| :--- | :---: | :---: |\n`;
  
  results.forEach(res => {
    md += `| **${res.name}** | ${res.count} | ${res.healthIcon} |\n`;
  });

  // Summary Table
  md += `\n---\n\n`;
  md += `## 📊 High-Level Summary\n\n`;
  md += `| Check | Status |\n`;
  md += `|-------|--------|\n`;
  
  results.forEach(res => {
    const icon = res.success ? '✅ Pass' : (res.allowFail ? '⚠️ Warning' : '❌ Fail');
    md += `| **${res.name}** | ${icon} |\n`;
  });
  
  md += `\n---\n\n`;
  md += `## 📋 Detailed Logs\n\n`;
  
  results.forEach(res => {
    const icon = res.success ? '✅' : (res.allowFail ? '⚠️' : '❌');
    md += `### ${icon} ${res.name}\n\n`;
    md += `*${res.description}*\n\n`;
    
    if (res.success && res.count === 0) {
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
        const warnLines = combinedOutput.split('\n').filter(l => l.includes('[warn]'));
        const errorLines = combinedOutput.split('\n').filter(l => l.includes('[error]'));
        
        if (warnLines.length > 0) {
          md += `#### Unformatted Files\n`;
          warnLines.forEach(l => {
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

  return md;
};

const main = async () => {
  console.log('🏥 Starting Local Health Checks...\n');
  const results = [];

  for (const check of checks) {
    console.log(`⏳ Running: ${check.name}...`);
    const result = await runCommand(check.command);
    
    const count = check.parse(result.stdout || result.stderr || '');
    const healthIcon = getHealthIcon(count);
    
    results.push({ ...check, ...result, count, healthIcon });
    
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
