import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath =
  process.argv[2] ??
  path.join(
    root,
    'release',
    process.platform === 'win32'
      ? 'win-unpacked/nesy-collage.exe'
      : 'linux-unpacked/nesy-collage',
  );
const temporary = await mkdtemp(path.join(os.tmpdir(), 'nesy-collage-smoke-'));
const env = { ...process.env, NESY_COLLAGE_USER_DATA: path.join(temporary, 'profile') };
// Linux CI containers may lack a usable Chromium sandbox. Release binaries retain it by default.
const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
let application;
try {
  application = await electron.launch({ executablePath, env, args, timeout: 60000 });
  let page = await application.firstWindow();
  await page.locator('.language-picker').selectOption('en');
  await expect(page.getByRole('button', { name: 'Print A4', exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext('2d').fillRect(0, 0, 800, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Add photos', { exact: true }).setInputFiles({
    name: '2026-12-25.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await page
    .getByRole('group', { name: 'Layout', exact: true })
    .getByRole('button', { name: 'Polaroid grid', exact: true })
    .click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: /Place 2026/ }).click();
  const filename = path.join(temporary, 'project.json');
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, filename);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('button', { name: 'Save project file', exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await readFile(filename, 'utf8')).pages?.length;
      } catch {
        return 0;
      }
    })
    .toBe(2);
  const pdf = await application.evaluate(async ({ BrowserWindow }) => {
    const bytes = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
    });
    return bytes.toString('base64');
  });
  assert.equal(
    Buffer.from(pdf, 'base64')
      .toString('latin1')
      .match(/\/Type\s*\/Page\b/g)?.length,
    2,
  );
  await page.getByLabel('Language', { exact: true }).selectOption('de');
  await expect(page.getByLabel('Bildunterschrift', { exact: true })).toHaveValue(
    'Dezember 2026',
  );
  await expect(page.getByRole('status').first()).toContainText('gespeichert');
  await application.close();
  application = await electron.launch({ executablePath, env, args, timeout: 60000 });
  page = await application.firstWindow();
  await expect(page.getByLabel('Sprache', { exact: true })).toHaveValue('de');
  await expect(page.getByLabel('Current page', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Aktuelle Seite', { exact: true })).toHaveValue('1');
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page.getByLabel('Bildunterschrift', { exact: true })).toHaveValue(
    'Dezember 2026',
  );
  console.log(
    'Desktop smoke test passed: imports, captions, native Save, 2-page PDF and persistent storage.',
  );
} finally {
  await application?.close();
  await rm(temporary, { recursive: true, force: true });
}
