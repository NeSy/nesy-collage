import { expect, test, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function action(page: Page, name: string) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

async function readyOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
}

test('is installable and restores photos and multiple pages after an offline reload', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await readyOffline(page);
  const session = await context.newCDPSession(page);
  const manifest = await session.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  expect(JSON.parse(manifest.data!).display).toBe('standalone');
  const installation = await session.send('Page.getInstallabilityErrors');
  // Playwright contexts are private profiles; exclude only that browser-mode restriction.
  expect(
    installation.installabilityErrors.filter((error) => error.errorId !== 'in-incognito'),
  ).toEqual([]);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext('2d')!.fillRect(0, 0, 800, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Add photos', { exact: true }).setInputFiles({
    name: '2026-12-25.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await page
    .getByRole('group', { name: 'Layout', exact: true })
    .getByRole('button', { name: 'Polaroid grid', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await expect(page.getByRole('status').first()).toHaveText('Saved on this device');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page.locator('app-a4-canvas:not(.inactive) .photo-zone img')).toHaveJSProperty(
    'naturalWidth',
    800,
  );
  const offlinePage = await context.newPage();
  await offlinePage.goto('./');
  await expect(offlinePage.getByLabel('Current page', { exact: true })).toHaveValue('1');
  const pdf = await offlinePage.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
});

test('saves using the browser file picker without a filename prompt', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const state = window as unknown as {
      pickerOptions: unknown;
      saved: string;
      saveClosed: boolean;
      active: boolean;
    };
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: unknown) => {
        state.pickerOptions = options;
        state.active = navigator.userActivation.isActive;
        return {
          createWritable: async () => ({
            write: async (data: string) => {
              state.saved = data;
            },
            close: async () => {
              state.saveClosed = true;
            },
            abort: async () => {},
          }),
        };
      },
    });
  });
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await action(page, 'Save project file');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { saveClosed: boolean }).saveClosed))
    .toBe(true);
  const state = await page.evaluate(() => {
    const state = window as unknown as {
      pickerOptions: unknown;
      saved: string;
      active: boolean;
    };
    return {
      options: state.pickerOptions,
      project: JSON.parse(state.saved),
      active: state.active,
    };
  });
  expect(state.options).toMatchObject({ suggestedName: 'collage-layout.json' });
  expect(state.project.id).toBeTruthy();
  expect(state.active).toBe(true);
  expect(dialogs).toEqual([]);
});

test('canceling the picker keeps the project and does not download a fallback', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.evaluate(() =>
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('Canceled', 'AbortError');
      },
    }),
  );
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await action(page, 'Save project file');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save project file', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1');
  expect(downloads).toEqual([]);
});

test('downloads directly without a prompt when the picker is unavailable', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() =>
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: undefined,
    }),
  );
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  const downloaded = page.waitForEvent('download');
  await action(page, 'Save project file');
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('collage-layout.json');
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).id).toBeTruthy();
  expect(dialogs).toEqual([]);
});

test('offers installation only when the browser supplies an install prompt', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset['installed'] = 'true';
      },
    });
    window.dispatchEvent(event);
  });
  await action(page, 'Install app');
  await expect(page.locator('html')).toHaveAttribute('data-installed', 'true');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toHaveCount(0);
});
