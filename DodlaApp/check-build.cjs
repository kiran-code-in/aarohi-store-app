const { execSync } = require('child_process');
const path = require('path');
const cwd = __dirname;

try {
  console.log('Running tsc --noEmit...');
  const result = execSync('npx tsc --noEmit', { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (result) console.log(result);
  console.log('BUILD CHECK: SUCCESS - TypeScript compiles without errors');
} catch (e) {
  console.log('BUILD CHECK: ERRORS FOUND');
  console.log(e.stdout || '');
  console.error(e.stderr || '');
  process.exit(1);
}
