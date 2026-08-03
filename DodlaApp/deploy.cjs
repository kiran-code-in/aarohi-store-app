/**
 * deploy.cjs — Copies Vite build output (dist/) to docs/ for GitHub Pages.
 * Run: npm run deploy
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'dist');
const dest = path.join(__dirname, '..', 'docs');

function copyDir(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean docs/
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

// Copy dist/ → docs/
if (!fs.existsSync(src)) {
  console.error('ERROR: dist/ folder not found. Run "npm run build" first.');
  process.exit(1);
}

copyDir(src, dest);
console.log('✓ Deployed dist/ → docs/');
console.log('  Now: git add docs/ && git commit && git push');
