import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ?? 'all';
if (!['all', 'win', 'linux', 'desktop'].includes(target)) {
  throw new Error('Use win, linux, all, or desktop.');
}
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Build exited with code ${code}`)),
    );
  });
}

await run('node_modules/@angular/cli/bin/ng.js', ['build']);
const staging = path.join(root, 'dist/desktop-app');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, 'dist/nesy-collage/browser'), path.join(staging, 'web'), {
  recursive: true,
});
for (const file of ['main.cjs', 'preload.cjs']) {
  await cp(path.join(root, 'desktop', file), path.join(staging, file));
}
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(
  path.join(staging, 'package.json'),
  JSON.stringify(
    {
      name: 'nesy-collage',
      version,
      main: 'main.cjs',
      description: 'Arrange photos across printable A4 collage pages.',
      author: 'NeSy',
      private: true,
      desktopName: 'nesy-collage.desktop',
      dependencies: {},
    },
    null,
    2,
  ),
);
if (target === 'desktop') {
  await run('node_modules/electron/cli.js', [staging]);
} else {
  // Finish the primary Windows release first and avoid compressing both platforms at once.
  for (const platform of target === 'all' ? ['win', 'linux'] : [target]) {
    await run('node_modules/electron-builder/cli.js', [
      '--config',
      'electron-builder.yml',
      `--${platform}`,
      '--publish',
      'never',
    ]);
  }
}
