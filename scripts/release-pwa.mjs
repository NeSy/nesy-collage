import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseHref = process.argv[2] ?? '/';
if (!baseHref.startsWith('/') || !baseHref.endsWith('/') || /[?#\\]/.test(baseHref))
  throw new Error('Provide a URL path starting and ending with /, for example /nesy-collage/.');
await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [
      path.join(root, 'node_modules/@angular/cli/bin/ng.js'),
      'build',
      '--output-path',
      'dist/pwa',
      '--base-href',
      baseHref,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  child.on('error', reject);
  child.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`PWA build failed (${code}).`)),
  );
});
const web = path.join(root, 'dist/pwa/browser');
await cp(
  path.join(root, 'dist/pwa/3rdpartylicenses.txt'),
  path.join(web, '3rdpartylicenses.txt'),
);
const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name + '/');
    else files[name] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect(web);
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release', `nesy-collage-${version}-pwa.zip`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, zipSync(files, { level: 6 }));
console.log(`PWA release: ${output}\nExtract to an HTTPS host at ${baseHref}`);
