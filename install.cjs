const { execSync } = require('child_process');
try {
  const r = execSync('npm install xlsx', { cwd: __dirname, encoding: 'utf8' });
  console.log(r);
  console.log('DONE');
} catch(e) {
  console.error(e.stderr || e.message);
}
