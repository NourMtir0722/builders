// Copies the site into ./dist for deploying. There is no bundling: the pages load plain ES modules.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of ['index.html', 'style.html']) cpSync(f, `dist/${f}`);
cpSync('src', 'dist/src', { recursive: true });
console.log('built ./dist');
