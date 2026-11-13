import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
const svg = await readFile(path.join(directory, 'icon.svg'), 'utf8');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, maskable] of [
    ['app-icon-192', 192, false],
    ['app-icon-512', 512, false],
    ['app-maskable-512', 512, true],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    const content = maskable
      ? svg
          .replaceAll('rx="112"', 'rx="0"')
          .replace(
            '<g id="artwork">',
            '<g transform="translate(64 64) scale(.75)"><g id="artwork">',
          )
          .replace('</svg>', '</g></svg>')
      : svg;
    await page.setContent(
      `<style>body{margin:0}img{display:block;width:100vw;height:100vh}</style><img src="data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    await writeFile(
      path.join(directory, name + '.png'),
      await page.screenshot({ omitBackground: true }),
    );
  }
} finally {
  await browser.close();
}
