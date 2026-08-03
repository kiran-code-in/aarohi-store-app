const { execSync } = require('child_process');
console.log('Installing in:', __dirname);
try {
  const r = execSync('npm install', { cwd: __dirname, encoding: 'utf8', stdio: 'pipe' });
  console.log(r);
  console.log('SUCCESS');
} catch (e) {
  console.error('FAILED:', e.stderr || e.message);
}
