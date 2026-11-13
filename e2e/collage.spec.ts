import { expect, test, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function addPhoto(page: Page, name = 'landscape.png', inputLabel = 'Add photos') {
  const beforeCount = await page.locator('.thumb').count();
  // A real raster image avoids relying on image codecs or network fixtures.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f80';
    context.fillRect(0, 0, 600, 800);
    context.fillStyle = '#06c';
    context.fillRect(600, 0, 600, 800);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel(inputLabel).setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('.thumb')).toHaveCount(beforeCount + 1);
  await expect(page.getByLabel(inputLabel)).toBeEnabled();
}

function layoutChoice(page: Page, mode: string) {
  return page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', {
    name: mode === 'polaroid' ? 'Polaroid grid' : 'Split layout',
    exact: true,
  });
}

async function projectAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

async function load(page: Page, value: unknown) {
  const chooser = page.waitForEvent('filechooser');
  await projectAction(page, 'Open project');
  await (
    await chooser
  ).setFiles({
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}

async function exportLayout(page: Page) {
  page.once('dialog', (dialog) => dialog.accept('test-collage.json'));
  const download = page.waitForEvent('download');
  await projectAction(page, 'Save project file');
  const path = await (await download).path();
  return JSON.parse(await readFile(path!, 'utf8'));
}

async function pan(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('keeps gallery slots fixed with a muted source photo throughout a drag', async ({ page }) => {
  for (const name of ['One.png', 'Two.png', 'Three.png']) await addPhoto(page, name);
  const slots = page.locator('.gallery-slot');
  const positions = () =>
    slots.evaluateAll((elements) =>
      elements.map((el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
  const before = await positions();
  const source = (await page.getByRole('button', { name: /Place One/ }).boundingBox())!;
  const target = (await page.locator('.photo-zone').boundingBox())!;
  await page.mouse.move(source.x + 30, source.y + 30);
  await page.mouse.down();
  await page.mouse.move(source.x + 45, source.y + 45, { steps: 5 });
  await expect(page.locator('.gallery-drag-placeholder')).toBeVisible();
  await expect(page.locator('.gallery-drag-placeholder img')).toHaveCSS('filter', 'grayscale(1)');
  expect(await positions()).toEqual(before);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 });
  await expect(page.locator('.gallery-drag-placeholder')).toBeVisible();
  expect(await positions()).toEqual(before);
  await page.mouse.up();
  await expect(page.locator('.photo-zone img')).toHaveAttribute('alt', 'One.png');
  await expect(page.locator('.gallery-drag-placeholder')).toHaveCount(0);
  expect(await positions()).toEqual(before);
});

test('opens the correct frame subtitle from its border, clears with undo and returns to mobile canvas', async ({
  page,
}, testInfo) => {
  await layoutChoice(page, 'polaroid').click();
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  await page.getByRole('button', { name: 'Edit subtitle for frame 1', exact: true }).click();
  const editor = page.getByLabel('Subtitle', { exact: true });
  await expect(editor).toBeFocused();
  await editor.fill('Summer in Paris');
  await expect(page.locator('.subtitle-count')).toHaveText('15/80');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Edit subtitle for frame 2', exact: true }).click();
  await expect(editor).toBeFocused();
  await editor.fill('Family memories');
  await expect(page.locator('app-polaroid-subtitle')).toHaveText([
    'Summer in Paris',
    'Family memories',
  ]);
  await page.getByRole('button', { name: 'Clear subtitle', exact: true }).click();
  await expect(editor).toHaveValue('');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(editor).toHaveValue('Family memories');
  await page.screenshot({ path: testInfo.outputPath('caption-editor.png') });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('tab', { name: 'Canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Edit subtitle for frame 1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Edit', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Summer in Paris');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Print preview', exact: true }).click();
  await expect(page.locator('.caption-edit').first()).toBeHidden();
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
  const photoSelection = page
    .getByRole('button', { name: 'Select photo zone', exact: true })
    .first();
  await photoSelection.focus();
  await photoSelection.press('Space');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.caption-edit').first()).toBeHidden();
  await expect(photoSelection).toHaveCSS('outline-style', 'none');
  await expect(page.locator('app-polaroid-subtitle').first()).toHaveText('Summer in Paris');
});

test('supports French browser defaults and persists language changes without altering the collage', async ({
  browser,
  page,
}, testInfo) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const frenchPage = await context.newPage();
  await frenchPage.goto(page.url());
  await expect(frenchPage.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(frenchPage.getByRole('button', { name: 'Imprimer A4', exact: true })).toBeVisible();
  await expect(
    frenchPage.getByRole('button', { name: 'Choisir des photos', exact: true }),
  ).toBeVisible();
  await frenchPage.getByLabel('Langue', { exact: true }).selectOption('en');
  await expect(frenchPage.getByRole('button', { name: 'Print A4', exact: true })).toBeVisible();
  await addPhoto(frenchPage, 'Été.png');
  await frenchPage.getByRole('button', { name: /Place Été/ }).click();
  await layoutChoice(frenchPage, 'polaroid').click();
  await frenchPage.getByLabel('Subtitle', { exact: true }).fill('Nos beaux souvenirs');
  await frenchPage.getByLabel('Language', { exact: true }).selectOption('fr');
  await expect(frenchPage.getByLabel('Légende', { exact: true })).toHaveValue(
    'Nos beaux souvenirs',
  );
  await expect(
    frenchPage.getByRole('button', {
      name: 'Placer Été.png dans le cadre sélectionné',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    frenchPage.getByRole('button', { name: 'Effacer la légende', exact: true }),
  ).toBeVisible();
  await frenchPage.reload();
  await expect(frenchPage.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(frenchPage.locator('app-polaroid-subtitle')).toHaveText('Nos beaux souvenirs');
  await frenchPage.getByRole('button', { name: 'Projet', exact: true }).click();
  frenchPage.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Effacer ce projet');
    await dialog.dismiss();
  });
  await frenchPage.getByRole('button', { name: 'Effacer le projet', exact: true }).click();
  for (const viewport of [
    { width: 1024, height: 600 },
    { width: 375, height: 667 },
  ]) {
    await frenchPage.setViewportSize(viewport);
    if (viewport.width <= 700)
      await frenchPage.getByRole('tab', { name: 'Modifier', exact: true }).click();
    await expect
      .poll(() =>
        frenchPage.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await expect(frenchPage.locator('.page')).toBeVisible();
  }
  await frenchPage.screenshot({ path: testInfo.outputPath('french-mobile.png') });
  await context.close();
});

test('offers visual starting layouts and opens the photo picker from the welcome panel', async ({
  page,
}, testInfo) => {
  await expect(page.getByRole('region', { name: 'Start your collage' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('welcome.png') });
  await page.getByRole('button', { name: 'Use Polaroid grid' }).click();
  await expect(layoutChoice(page, 'polaroid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Use Polaroid grid' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photos', exact: true }).click();
  expect((await chooser).isMultiple()).toBe(true);
  await addPhoto(page);
  await expect(page.getByRole('region', { name: 'Start your collage' })).toBeHidden();
});

test('filters gallery filenames and updates usage badges through placement, removal and undo', async ({
  page,
}, testInfo) => {
  await addPhoto(page, 'Beach.png');
  await addPhoto(page, 'Mountains.png');
  const beach = page.getByRole('button', { name: /Place Beach/ });
  await expect(beach.locator('.photo-name')).toHaveText('Beach.png');
  await beach.click();
  await expect(beach.locator('.usage-badge')).toHaveText('Used ×1');
  await page.screenshot({ path: testInfo.outputPath('gallery.png') });
  await page.getByLabel('Search photos').fill('MOUNTAIN');
  await expect(page.locator('.photo-tile')).toHaveCount(1);
  await expect(page.locator('.photo-name')).toHaveText(['Mountains.png']);
  await page.getByLabel('Search photos').fill('');
  await page.getByLabel('Unused only').check();
  await expect(page.locator('.photo-name')).toHaveText(['Mountains.png']);
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.locator('.photo-tile')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.photo-name')).toHaveText(['Mountains.png']);
  await page.getByLabel('Search photos').fill('no match');
  await expect(page.getByText('No photos match these filters.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Gallery pages' })).toHaveCount(0);
});

test('imports native file drops once and reports unsupported files without navigating', async ({
  page,
}) => {
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), (c) =>
      c.charCodeAt(0),
    );
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'Dropped.png', { type: 'image/png' }));
    const gallery = document.querySelector('.library')!;
    gallery.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }),
    );
    gallery.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }),
    );
  });
  await expect(page.locator('.photo-name')).toHaveText('Dropped.png');
  await expect(page.locator('.library')).not.toHaveClass(/file-drag-over/);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(['text'], 'Notes.txt', { type: 'text/plain' }));
    document.body.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }),
    );
  });
  await expect(page.getByRole('alert')).toHaveText('Notes.txt is not an image.');
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page).toHaveURL(/\/$/);
});

test('mobile tabs provide full-width photos, canvas and editing without scrolling', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Use Polaroid grid' }).click();
  await addPhoto(page);
  await expect(page.getByRole('tab', { name: 'Photos', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('app-image-library')).toBeVisible();
  await expect(page.locator('app-a4-canvas')).toBeHidden();
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('app-photo-tools')).toBeHidden();
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  const canvasTab = page.getByRole('tab', { name: 'Canvas', exact: true });
  await canvasTab.focus();
  const before = await page.locator('.photo-zone img').getAttribute('style');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Edit', exact: true })).toBeFocused();
  await expect(page.locator('.photo-zone img')).toHaveAttribute('style', before!);
  await expect(page.getByLabel('Subtitle', { exact: true })).toBeVisible();
  await page.getByLabel('Subtitle', { exact: true }).fill('A lovely day');
  await expect(page.locator('app-polaroid-subtitle')).toHaveText('A lovely day');
  await page.screenshot({ path: testInfo.outputPath('mobile-edit.png') });
  for (const size of [
    { width: 375, height: 667 },
    { width: 600, height: 700 },
    { width: 1024, height: 600 },
  ]) {
    await page.setViewportSize(size);
    for (const panel of ['Photos', 'Canvas', 'Edit']) {
      if (size.width <= 700) await page.getByRole('tab', { name: panel, exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight &&
              document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (panel === 'Photos') {
        await expect
          .poll(() => page.locator('.library').evaluate((el) => el.scrollHeight <= el.clientHeight))
          .toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('tab', { name: 'Photos', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.page')).toBeVisible();
  await expect(page.locator('.mobile-tabs')).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
});

test('print preview shows output colors and suspends edits until returning to the canvas', async ({
  page,
}, testInfo) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await page.getByRole('separator').focus();
  const ratio = await page.getByRole('separator').getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'Print preview', exact: true }).click();
  await expect(page.locator('.page')).toHaveAttribute('inert', '');
  await expect(page.locator('app-image-library')).toBeHidden();
  await expect(page.locator('app-photo-tools')).toHaveCount(0);
  await expect(page.locator('.placeholder').last()).toBeHidden();
  await expect(page.locator('.photo-zone').last()).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.keyboard.press('Delete');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.separator')).toHaveCount(1);
  await expect(page.locator('.separator')).toHaveAttribute('aria-valuenow', ratio!);
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
  await layoutChoice(page, 'polaroid').click();
  await page.getByRole('button', { name: 'Print preview', exact: true }).click();
  await expect(page.locator('.polaroid-grid')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.polaroid-frame').first()).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.polaroid-frame').first()).toHaveCSS('outline-style', 'none');
  await page.screenshot({ path: testInfo.outputPath('print-preview.png') });
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
  await expect(page.locator('.page')).not.toHaveAttribute('inert', '');
  await expect(page.locator('app-photo-tools')).toBeVisible();
});

test('imports bounded thumbnails, places full-resolution originals, and saves image references', async ({
  page,
}) => {
  await addPhoto(page);
  const thumbSize = await page.locator('.thumb').evaluate((img: HTMLImageElement) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
    src: img.src,
  }));
  expect(thumbSize.width).toBe(200);
  expect(thumbSize.height).toBeLessThanOrEqual(200);
  expect(thumbSize.src).toMatch(/^blob:/);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  const image = page.locator('.photo-zone img');
  await expect(image).toHaveJSProperty('naturalWidth', 1200);
  await expect(image).toHaveAttribute('src', /^blob:/);
  const layout = await exportLayout(page);
  expect(layout.image.src).toMatch(/^asset:/);
  expect(JSON.stringify(layout)).not.toContain('data:image/');
  expect(JSON.stringify(layout)).not.toContain('blob:');
  expect(layout.image.name).toBe('landscape.png');
  await page.reload();
  await load(page, layout);
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await expect(page.locator('.photo-zone img')).toHaveAttribute('src', /^blob:/);
});

test('supports nested splitting, dragging photos and removing a root separator', async ({
  page,
}) => {
  await addPhoto(page);
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await page.getByRole('button', { name: 'Split horizontally', exact: true }).click();
  await expect(page.locator('.photo-zone')).toHaveCount(3);
  const target = page.locator('.photo-zone').last();
  const from = (await page.locator('.thumb').boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 50, from.y + 50);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 60, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(target.locator('img')).toHaveJSProperty('naturalWidth', 1200);
  const separator = page.getByRole('separator').first();
  await separator.focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.photo-zone')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.photo-zone')).toHaveCount(3);
});

test('undoes a complete pan, wheel burst, and separator resize', async ({ page }) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  const image = page.locator('.photo-zone img');
  await expect(image).toHaveJSProperty('naturalWidth', 1200);
  const before = await image.evaluate((el) => (el as HTMLElement).style.transform);
  const box = (await page.locator('.photo-zone').boundingBox())!;
  await pan(page, box.x + 100, box.y + 100, 35, 25);
  await expect(image).not.toHaveCSS('transform', 'none');
  expect(await image.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(image).toHaveAttribute('style', expect.stringContaining(before));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const panned = await image.evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.move(box.x + 150, box.y + 150);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -20);
  await expect
    .poll(() => image.evaluate((el) => (el as HTMLElement).style.transform))
    .not.toBe(panned);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(image).toHaveAttribute('style', expect.stringContaining(panned));
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  const separator = page.getByRole('separator');
  const handle = (await separator.boundingBox())!;
  await pan(page, handle.x + handle.width / 2, handle.y + handle.height / 2, 70, 0);
  await expect(separator).not.toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(separator).toHaveAttribute('aria-valuenow', '50');
});

test('rejects malformed imports without replacing the current collage', async ({ page }) => {
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await load(page, { id: 'broken', direction: 'vertical', ratio: 0.5 });
  await expect(page.getByRole('alert')).toContainText('object');
  await expect(page.locator('.photo-zone')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.photo-zone')).toHaveCount(1);
});

test('supports keyboard selection and resizing, and Command undo', async ({ page }) => {
  await addPhoto(page);
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select photo zone', exact: true })).toHaveCount(2);
  const zone = page.getByRole('button', { name: 'Select photo zone', exact: true }).last();
  await zone.focus();
  await page.keyboard.press('Enter');
  const photo = page.getByRole('button', { name: /Place landscape/ });
  await photo.focus();
  await page.keyboard.press('Enter');
  await expect(zone.locator('img')).toHaveJSProperty('naturalWidth', 1200);
  const separator = page.getByRole('separator');
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).not.toHaveAttribute('aria-valuenow', '50');
  await page.keyboard.press('Meta+z');
  await expect(separator).toHaveAttribute('aria-valuenow', '50');
});

test('prints one A4 page with the original photo and no editing controls', async ({ page }) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('app-toolbar')).toBeHidden();
  await expect(page.locator('app-image-library')).toBeHidden();
  const box = (await page.locator('.page').boundingBox())!;
  expect(box.width).toBeCloseTo((210 * 96) / 25.4, 0);
  expect(box.height).toBeCloseTo((297 * 96) / 25.4, 0);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const contents = pdf.toString('latin1');
  expect(contents.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  const mediaBox = /\/MediaBox\s*\[([\d. ]+)\]/.exec(contents);
  expect(mediaBox).not.toBeNull();
  const [, , width, height] = mediaBox![1].trim().split(/\s+/).map(Number);
  expect(width).toBeCloseTo((210 * 72) / 25.4, 0);
  expect(height).toBeCloseTo((297 * 72) / 25.4, 0);
});

test('switches between recursive and Polaroid layouts, saves the choice and prints the grid', async ({
  page,
}) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await layoutChoice(page, 'polaroid').click();
  await expect(page.locator('.polaroid-frame')).toHaveCount(2);
  await expect(page.getByRole('separator')).toHaveCount(0);
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await page.getByLabel('Columns', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  await expect(page.locator('.polaroid-frame')).toHaveCount(3);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await expect(page.locator('.photo-zone img')).toHaveCount(2);
  const layout = await exportLayout(page);
  expect(layout.presentation).toEqual({ mode: 'polaroid', columns: 3 });
  await page.reload();
  await load(page, layout);
  await expect(layoutChoice(page, 'polaroid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('3');
  await expect(page.locator('.polaroid-frame')).toHaveCount(3);
  await expect(page.locator('.photo-zone img')).toHaveCount(2);
  await layoutChoice(page, 'tree').click();
  await expect(page.getByRole('separator')).toHaveCount(2);
  await expect(page.locator('.photo-zone img')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.polaroid-frame')).toHaveCount(3);
  await page.getByRole('button', { name: 'Remove frame', exact: true }).click();
  await expect(page.locator('.polaroid-frame')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.polaroid-frame')).toHaveCount(3);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.polaroid-frame').first()).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
});

test('centers independent handwritten subtitles in the white border and preserves them in saved layouts', async ({
  page,
}, testInfo) => {
  await layoutChoice(page, 'polaroid').click();
  const editor = page.getByLabel('Subtitle', { exact: true });
  await editor.fill('Été à Paris');
  await editor.press('Tab');
  const first = page.locator('.polaroid-frame').first();
  await expect(first.locator('app-polaroid-subtitle')).toHaveText('Été à Paris');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(first.locator('app-polaroid-subtitle')).toHaveText('');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(first.locator('app-polaroid-subtitle')).toHaveText('Été à Paris');
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  await editor.fill('Souvenirs de famille');
  await editor.press('Tab');
  await expect(page.locator('app-polaroid-subtitle').nth(1)).toHaveText('Souvenirs de famille');
  await expect(first.locator('app-polaroid-subtitle')).toHaveText('Été à Paris');
  await page.evaluate(() => document.fonts.ready);
  const caption = first.locator('app-polaroid-subtitle');
  const frameBox = (await first.boundingBox())!;
  const captionBox = (await caption.boundingBox())!;
  const textBox = (await caption.locator('span').boundingBox())!;
  expect(captionBox.x + captionBox.width / 2).toBeCloseTo(frameBox.x + frameBox.width / 2, 0);
  expect(captionBox.y + captionBox.height).toBeCloseTo(frameBox.y + frameBox.height, 0);
  expect(textBox.y + textBox.height / 2).toBeCloseTo(captionBox.y + captionBox.height / 2, 0);
  await expect(caption).toHaveCSS('font-family', 'Caveat, cursive');
  expect(await page.evaluate(() => document.fonts.check('24px Caveat', 'Été à Paris'))).toBe(true);
  const saved = await exportLayout(page);
  expect(saved.first.subtitle).toBe('Été à Paris');
  expect(saved.second.subtitle).toBe('Souvenirs de famille');
  await page.reload();
  await load(page, saved);
  await expect(page.locator('app-polaroid-subtitle').first()).toHaveText('Été à Paris');
  await expect(page.locator('app-polaroid-subtitle').nth(1)).toHaveText('Souvenirs de famille');
  await page.screenshot({ path: testInfo.outputPath('subtitles.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('app-polaroid-subtitle').first()).toBeVisible();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
});

test('fits a long subtitle inside the bottom border at four columns', async ({ page }) => {
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Columns', { exact: true }).selectOption('4');
  const title = 'A long summer holiday full of wonderful memories with our family and friends';
  await page.getByLabel('Subtitle', { exact: true }).fill(title);
  await page.getByLabel('Subtitle', { exact: true }).press('Tab');
  const caption = page.locator('app-polaroid-subtitle').first();
  await expect(caption).toHaveText(title);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      caption.evaluate((host) => {
        const text = host.querySelector('span')!;
        return text.scrollHeight <= host.clientHeight && text.scrollWidth <= host.clientWidth;
      }),
    )
    .toBe(true);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 600 },
  { width: 600, height: 700 },
  { width: 375, height: 667 },
]) {
  test(`fits the complete workspace without scrolling at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const mode of ['tree', 'polaroid']) {
      await layoutChoice(page, mode).click();
      await expect
        .poll(async () => {
          const paper = (await page.locator('.page').boundingBox())!;
          if (viewport.width <= 700) {
            await expect(page.getByRole('tab', { name: 'Canvas', exact: true })).toBeVisible();
            return (
              paper.x >= 0 &&
              paper.y >= 0 &&
              paper.y + paper.height <= viewport.height + 1 &&
              paper.x + paper.width <= viewport.width + 1
            );
          }
          const gallery = (await page
            .getByRole('region', { name: 'Photo gallery' })
            .boundingBox())!;
          return (
            paper.x >= gallery.x + gallery.width &&
            paper.y >= 0 &&
            paper.y + paper.height <= viewport.height + 1 &&
            paper.x + paper.width <= viewport.width + 1
          );
        })
        .toBe(true);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <= window.innerHeight &&
            document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (viewport.width > 700)
        expect(
          await page.locator('.library').evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
    }
  });
}

test('scrolls a large gallery, filters from the top and keeps the full A4 preview visible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#3b82f6';
    context.fillRect(0, 0, 20, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Add photos').setInputFiles(
    Array.from({ length: 50 }, (_, i) => ({
      name: `photo-${i}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(data, 'base64'),
    })),
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const project = localStorage.getItem('photo-armaurie:last-project');
          return project ? JSON.parse(project).gallery.length : 0;
        }),
      { timeout: 15000 },
    )
    .toBe(50);
  await expect(page.getByLabel('Add photos')).toBeEnabled();
  await expect(page.locator('.thumb')).toHaveCount(50);
  await expect(page.getByRole('navigation', { name: 'Gallery pages' })).toHaveCount(0);
  const gallery = page.getByRole('region', { name: 'Gallery photos', exact: true });
  const galleryBox = (await gallery.boundingBox())!;
  await page.mouse.move(galleryBox.x + 30, galleryBox.y + 30);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => gallery.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const lastPhoto = page.getByRole('button', {
    name: 'Place photo-49.png in selected photo zone',
    exact: true,
  });
  await lastPhoto.scrollIntoViewIfNeeded();
  const from = (await lastPhoto.boundingBox())!;
  const to = (await page.locator('.photo-zone').boundingBox())!;
  await page.mouse.move(from.x + 30, from.y + 30);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 40, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator('.photo-zone img')).toHaveAttribute('alt', 'photo-49.png');
  await page.getByLabel('Search photos').fill('photo-0.png');
  await expect(page.locator('.photo-tile')).toHaveCount(1);
  await expect.poll(() => gallery.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByLabel('Search photos').fill('');
  await expect(page.locator('.photo-tile')).toHaveCount(50);
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Summer memories');
  await page.getByLabel('Subtitle', { exact: true }).press('Tab');
  expect(
    await page.locator('.library').evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('split-workspace.png') });
});

test('gallery remains draggable after separator selection and repeated empty-zone clicks', async ({
  page,
}) => {
  await addPhoto(page);
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await page.getByRole('button', { name: 'Split horizontally', exact: true }).click();
  const galleryPhoto = page.getByRole('button', { name: /Place landscape/ });
  const separators = page.getByRole('separator');
  const emptyZones = page.getByRole('button', { name: 'Select photo zone', exact: true });

  for (let i = 0; i < 4; i++) {
    const handle = separators.nth(i % 2);
    const box = (await handle.boundingBox())!;
    await pan(
      page,
      box.x + box.width / 2,
      box.y + box.height / 2,
      i % 2 === 0 ? 15 : 0,
      i % 2 === 1 ? 15 : 0,
    );
    await handle.focus();
    // This used to disable the native gallery button, including its drag source.
    await galleryPhoto.click({ force: true });
    for (let j = 0; j < 3; j++) await emptyZones.nth((i + j) % 3).click();
    await expect(galleryPhoto).toBeEnabled();
  }

  // Dragging must also work directly from a separator selection.
  await separators.first().focus();
  await expect(galleryPhoto).toBeEnabled();
  const source = (await galleryPhoto.boundingBox())!;
  const target = page.locator('.photo-zone').last();
  const box = (await target.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, {
    steps: 3,
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(target.locator('img')).toHaveJSProperty('naturalWidth', 1200);
  await expect(galleryPhoto).toBeEnabled();
});

for (const mode of ['tree', 'polaroid']) {
  test(`nudges the selected ${mode} photograph by one document pixel and supports undo`, async ({
    page,
  }) => {
    await addPhoto(page);
    await layoutChoice(page, mode).click();
    await page.getByRole('button', { name: /Place landscape/ }).click();
    const image = page.locator('.photo-zone img');
    await expect(image).toHaveJSProperty('naturalWidth', 1200);
    await page.getByRole('button', { name: 'Select photo zone', exact: true }).click();
    const position = () =>
      image.evaluate((el) => {
        const transform = new DOMMatrix(getComputedStyle(el).transform);
        return { x: transform.m41, y: transform.m42 };
      });
    const before = await position();
    for (const [key, x, y] of [
      ['ArrowRight', 1, 0],
      ['ArrowDown', 1, 1],
      ['ArrowLeft', 0, 1],
      ['ArrowUp', 0, 0],
    ] as const) {
      await page.keyboard.press(key);
      await expect.poll(position).toEqual({ x: before.x + x, y: before.y + y });
    }
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await expect.poll(position).toEqual({ x: before.x + 2, y: before.y });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(position).toEqual(before);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(position).toEqual({ x: before.x + 2, y: before.y });
    if (mode === 'polaroid') {
      const field = page.getByLabel('Subtitle', { exact: true });
      await field.fill('Summer');
      await field.press('ArrowLeft');
      await field.press('ArrowDown');
      await expect.poll(position).toEqual({ x: before.x + 2, y: before.y });
    }
  });
}

test('nudges selected nested separators by one document pixel without requiring handle focus', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await page.getByRole('button', { name: 'Split horizontally', exact: true }).click();
  for (const orientation of ['vertical', 'horizontal']) {
    const separator = page.locator(`[role="separator"][aria-orientation="${orientation}"]`);
    const position = () =>
      separator.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const scale = Number(el.closest('.page')!.getAttribute('data-preview-scale'));
        return (
          (el.getAttribute('aria-orientation') === 'vertical'
            ? rect.x + rect.width / 2
            : rect.y + rect.height / 2) / scale
        );
      });
    await separator.focus();
    const before = await position();
    const forward = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    const backward = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    await page.keyboard.press(forward);
    await expect.poll(async () => (await position()) - before).toBeCloseTo(1, 1);
    await page.keyboard.press(backward);
    await expect.poll(async () => (await position()) - before).toBeCloseTo(0, 1);
    await page.keyboard.press(orientation === 'vertical' ? 'ArrowUp' : 'ArrowRight');
    await expect.poll(async () => (await position()) - before).toBeCloseTo(0, 1);
    await page.getByRole('button', { name: 'Project', exact: true }).focus();
    await page.keyboard.press(forward);
    await expect.poll(async () => (await position()) - before).toBeCloseTo(1, 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await position()) - before).toBeCloseTo(0, 1);
  }
});

test('automatically restores the last project, crops, subtitles and unplaced gallery photos', async ({
  page,
  context,
}) => {
  await addPhoto(page);
  await addPhoto(page, 'spare.png');
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Columns', { exact: true }).selectOption('3');
  await page.getByLabel('Subtitle', { exact: true }).fill('Remember this trip');
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  await page.getByRole('button', { name: 'Select photo zone', exact: true }).first().click();
  const beforeNudge = await page.locator('.photo-zone img').getAttribute('style');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.photo-zone img')).not.toHaveAttribute('style', beforeNudge!);
  const transform = await page.locator('.photo-zone img').getAttribute('style');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('photo-armaurie:last-project')))
    .toContain('Remember this trip');
  const project = await page.evaluate(() => localStorage.getItem('photo-armaurie:last-project')!);
  expect(project).not.toContain('data:image/');
  expect(project).not.toContain('blob:');
  expect(project.length).toBeLessThan(2500);
  expect(JSON.parse(project).gallery).toHaveLength(2);
  await page.reload();
  await expect(layoutChoice(page, 'polaroid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('3');
  await expect(page.locator('app-polaroid-subtitle').first()).toHaveText('Remember this trip');
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await expect(page.locator('.photo-zone img')).toHaveAttribute('style', transform!);
  await expect(page.locator('.thumb')).toHaveCount(2);
  // Closing/reopening a tab also requires fresh display URLs, not saved blob URLs.
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect(reopened.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await expect(reopened.locator('.thumb')).toHaveCount(2);
  await reopened.close();
});

test('flushes the final edit on reload without waiting for the autosave debounce', async ({
  page,
}) => {
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Last moment edit');
  await page.reload();
  await expect(page.locator('app-polaroid-subtitle').first()).toHaveText('Last moment edit');
});

test('reconnects missing image references by filename without losing the saved crop', async ({
  page,
}) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await page.getByRole('button', { name: 'Select photo zone', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  const saved = await exportLayout(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('photo-armaurie-images', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: 'Some photos are unavailable' }),
  ).toContainText('Some photos are unavailable');
  await expect(page.locator('.placeholder')).toContainText('landscape.png');
  await addPhoto(page);
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  const relinked = await exportLayout(page);
  expect(relinked.image).toEqual(saved.image);
});

test('migrates legacy embedded photos and keeps new saves reference-only', async ({ page }) => {
  const src = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    return canvas.toDataURL('image/png');
  });
  await load(page, {
    id: 'legacy',
    image: { src, name: 'legacy.png', scale: 1, offsetX: -10, offsetY: -20, __dirty: false },
  });
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 600);
  const saved = await exportLayout(page);
  expect(saved.image.src).toMatch(/^asset:/);
  expect(JSON.stringify(saved)).not.toContain('data:image/');
  expect(saved.image).toMatchObject({ offsetX: -10, offsetY: -20, scale: 1 });
  await page.reload();
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 600);
});

test('reports local storage failures while keeping the project editable and downloadable', async ({
  page,
}) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };
  });
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Keep this project');
  await expect(page.getByRole('status').filter({ hasText: 'Could not auto-save' })).toContainText(
    'Could not auto-save',
  );
  const saved = await exportLayout(page);
  expect(saved.subtitle).toBe('Keep this project');
});

test('clears the project, stored photos and history without bringing them back on reload', async ({
  page,
}) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Old project');
  await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await projectAction(page, 'Clear project');
  await expect(page.locator('.thumb')).toHaveCount(0);
  await expect(page.locator('.photo-zone img')).toHaveCount(0);
  await expect(page.locator('.photo-zone')).toHaveCount(1);
  await expect(layoutChoice(page, 'tree')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('photo-armaurie:last-project'))).toBeNull();
  const count = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('photo-armaurie-images', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const count = await new Promise<number>((resolve) => {
      const request = db.transaction('images', 'readonly').objectStore('images').count();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return count;
  });
  expect(count).toBe(0);
  await page.reload();
  await expect(page.locator('.thumb')).toHaveCount(0);
  await expect(page.locator('.photo-zone')).toHaveCount(1);
  await expect(page.locator('.photo-zone img')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('photo-armaurie:last-project'))).toBeNull();
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
});

test('canceling clear project keeps the collage and gallery', async ({ page }) => {
  await addPhoto(page);
  await page.getByRole('button', { name: /Place landscape/ }).click();
  await layoutChoice(page, 'polaroid').click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Keep this');
  page.once('dialog', (dialog) => dialog.dismiss());
  await projectAction(page, 'Clear project');
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page.locator('.photo-zone img')).toHaveJSProperty('naturalWidth', 1200);
  await expect(page.locator('app-polaroid-subtitle')).toHaveText('Keep this');
});

test('clearing during a photo import prevents the pending photo from returning', async ({
  page,
}) => {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.evaluate(() => {
    const controls = window as unknown as { finishPreview: () => void };
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = (image: ImageBitmapSource, options?: ImageBitmapOptions) =>
      new Promise<ImageBitmap>((resolve, reject) => {
        controls.finishPreview = () => {
          void original(image, options).then(resolve, reject);
        };
      });
  });
  await page.getByLabel('Add photos').setInputFiles({
    name: 'pending.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  });
  await expect(page.getByLabel('Add photos')).toBeDisabled();
  await expect(page.getByText('Preparing 1 of 1 photos…', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await projectAction(page, 'Clear project');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeEnabled();
  await page.evaluate(() => (window as unknown as { finishPreview: () => void }).finishPreview());
  await expect(page.getByLabel('Add photos')).toBeEnabled();
  await expect(page.locator('.thumb')).toHaveCount(0);
  await expect(page.locator('.photo-zone img')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('photo-armaurie:last-project'))).toBeNull();
});

for (const mode of ['tree', 'polaroid']) {
  test(`photo tools center, zoom, reset and remove a ${mode} photo with undo`, async ({ page }) => {
    await addPhoto(page);
    await layoutChoice(page, mode).click();
    await page.getByRole('button', { name: /Place landscape/ }).click();
    await expect(page.getByRole('button', { name: 'Reset crop', exact: true })).toBeEnabled();
    const image = page.locator('.photo-zone img');
    const transform = () =>
      image.evaluate((el) => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return { x: matrix.m41, y: matrix.m42, scale: matrix.a };
      });
    const initial = await transform();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(async () => (await transform()).scale / initial.scale).toBeCloseTo(1.05, 4);
    await page.getByRole('button', { name: 'Center', exact: true }).click();
    const centered = await image.evaluate((el: HTMLImageElement) => {
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return {
        x: matrix.m41,
        expected: (el.parentElement!.clientWidth - el.naturalWidth * matrix.a) / 2,
      };
    });
    expect(centered.x).toBeCloseTo(centered.expected, 2);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await transform()).x - centered.x).toBeCloseTo(1, 2);
    const moved = await transform();
    await page.getByRole('button', { name: 'Reset crop', exact: true }).click();
    await expect.poll(transform).toEqual(initial);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(transform).toEqual(moved);
    if (mode === 'polaroid') {
      await page.getByLabel('Subtitle', { exact: true }).fill('Keep the frame');
      await page.getByLabel('Subtitle', { exact: true }).press('Tab');
    }
    await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
    await expect(image).toHaveCount(0);
    await expect(page.locator('.photo-zone')).toHaveCount(1);
    await expect(page.locator('.thumb')).toHaveCount(1);
    if (mode === 'polaroid')
      await expect(page.locator('app-polaroid-subtitle')).toHaveText('Keep the frame');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(image).toHaveJSProperty('naturalWidth', 1200);
    await expect.poll(transform).toEqual(moved);
  });
}

test('project menu supports keyboard dismissal and shows clear local-save feedback', async ({
  page,
}) => {
  await expect(page.locator('.save-status')).toHaveText('New project');
  await expect(page.getByRole('button', { name: 'Save project file', exact: true })).toHaveCount(0);
  const project = page.getByRole('button', { name: 'Project', exact: true });
  await project.click();
  await expect(project).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByText('Project files reference photos stored on this device.', { exact: false }),
  ).toBeVisible();
  await project.press('Tab');
  await expect(page.getByRole('button', { name: 'Save project file', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(project).toBeFocused();
  await expect(project).toHaveAttribute('aria-expanded', 'false');
  await project.click();
  await layoutChoice(page, 'tree').click();
  await expect(project).toHaveAttribute('aria-expanded', 'false');
  await layoutChoice(page, 'polaroid').click();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  await page.reload();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
});

test('separator hit targets stay usable outside the visible line in a scaled preview', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  const separator = page.getByRole('separator');
  const before = (await separator.boundingBox())!;
  await pan(page, before.x - 7, before.y + before.height / 2, 25, 0);
  await expect.poll(async () => (await separator.boundingBox())!.x - before.x).toBeCloseTo(25, 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await separator.boundingBox())!.x - before.x).toBeCloseTo(0, 0);
});

for (const axis of ['horizontal', 'vertical']) {
  test(`gallery drag near a ${axis} crop edge does not scroll or move an existing photo`, async ({
    page,
  }) => {
    await addPhoto(page);
    await page.getByRole('button', { name: /Place landscape/ }).click();
    await page
      .getByRole('button', {
        name: axis === 'horizontal' ? 'Split vertically' : 'Split horizontally',
        exact: true,
      })
      .click();
    if (axis === 'vertical')
      await page.getByRole('button', { name: 'Split horizontally', exact: true }).click();
    await page.getByRole('button', { name: 'Reset crop', exact: true }).click();
    const zone = page.locator('.photo-zone').first();
    const image = zone.locator('img');
    await expect(image).toHaveJSProperty('naturalWidth', 1200);
    const before = await image.getAttribute('style');
    const source = (await page.locator('.thumb').boundingBox())!;
    const target = (await zone.boundingBox())!;
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, {
      steps: 3,
    });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
    await page.mouse.move(
      axis === 'horizontal' ? target.x + target.width - 1 : target.x + target.width / 2,
      axis === 'vertical' ? target.y + target.height - 1 : target.y + target.height / 2,
      { steps: 8 },
    );
    // A sustained edge hover used to auto-scroll the clipped image container.
    await page.waitForTimeout(250);
    expect(
      await zone.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop })),
    ).toEqual({ x: 0, y: 0 });
    // Crossing onto the separator must not start container scrolling either.
    await page.mouse.move(
      axis === 'horizontal' ? target.x + target.width + 1 : target.x + target.width / 2,
      axis === 'vertical' ? target.y + target.height + 1 : target.y + target.height / 2,
    );
    await page.waitForTimeout(150);
    expect(
      await zone.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop })),
    ).toEqual({ x: 0, y: 0 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
    await page.mouse.move(10, 10, { steps: 10 });
    await page.mouse.up();
    await expect(image).toHaveAttribute('style', before!);
  });
}

test('edits, restores and prints multiple A4 pages with independent layouts', async ({
  page,
}) => {
  await addPhoto(page, '2026-12-25.png');
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await layoutChoice(page, 'polaroid').click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1');
  await layoutChoice(page, 'tree').click();
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await page.getByRole('button', { name: 'Split vertically', exact: true }).click();
  await expect(page.locator('app-a4-canvas:not(.inactive) .photo-zone')).toHaveCount(2);
  await expect(page.getByLabel('Used 2 times', { exact: true })).toBeVisible();
  const project = await exportLayout(page);
  expect(project.pages).toHaveLength(2);
  expect(project.pages[0].subtitle).toBe('December 2026');
  expect(project.pages[1].direction).toBe('vertical');
  await page.reload();
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1');
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page.locator('app-a4-canvas:not(.inactive) .photo-zone')).toHaveCount(2);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.getByRole('button', { name: 'Print preview', exact: true }).click();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('app-a4-canvas:not(.inactive) .page')).not.toHaveClass(
    /polaroid-page/,
  );
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.page').nth(0)).toBeVisible();
  await expect(page.locator('.page').nth(1)).toBeVisible();
  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove page', exact: true }).click();
  await expect(page.getByLabel('Current page', { exact: true }).locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Current page', { exact: true }).locator('option')).toHaveCount(2);
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1');
});

test('uses capture metadata before filenames and translates automatic captions across pages', async ({
  page,
}) => {
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    canvas.getContext('2d')!.fillRect(0, 0, 120, 80);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  });
  const tiff = Buffer.alloc(64);
  tiff.set([0x49, 0x49, 42, 0, 8, 0, 0, 0]);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32);
  tiff.writeUInt32LE(44, 36);
  tiff.write('2026:12:25 12:30:00\0', 44, 'ascii');
  const original = Buffer.from(jpeg, 'base64');
  await page.getByLabel('Add photos').setInputFiles({
    name: '2025-07-01.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.concat([
      original.subarray(0, 2),
      Buffer.from([0xff, 0xe1, 0, 72, 69, 120, 105, 102, 0, 0]),
      tiff,
      original.subarray(2),
    ]),
  });
  await expect(page.locator('.thumb')).toHaveCount(1);
  await page.getByRole('button', { name: /Place 2025/ }).click();
  await layoutChoice(page, 'polaroid').click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: /Place 2025/ }).click();
  await page.getByLabel('Subtitle', { exact: true }).fill('Christmas');
  await page.getByLabel('Language', { exact: true }).selectOption('fr');
  await expect(page.getByLabel('Légende', { exact: true })).toHaveValue('Christmas');
  await page.getByRole('button', { name: 'Page précédente', exact: true }).click();
  await expect(page.getByLabel('Légende', { exact: true })).toHaveValue('Décembre 2026');
  await page.reload();
  await expect(page.getByLabel('Légende', { exact: true })).toHaveValue('Décembre 2026');
  await page.getByLabel('Langue', { exact: true }).selectOption('en');
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.getByRole('button', { name: 'Clear subtitle', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('');
});


test('combines page and layout controls and puts frame tools beside the full-height preview', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await addPhoto(page, '2026-12-25.png');
  await page.getByRole('button', { name: /Place 2026/ }).click();
  await layoutChoice(page, 'polaroid').click();
  const pages = page.getByRole('navigation', { name: 'Pages', exact: true });
  await expect(pages.getByRole('button', { name: 'Remove page', exact: true })).toHaveCount(0);
  const currentPage = page.getByRole('group', { name: 'Current page · 1', exact: true });
  await expect(currentPage.getByRole('button', { name: 'Remove page', exact: true })).toBeDisabled();
  await pages.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Current page · 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(currentPage).toBeVisible();
  const tools = page.getByRole('region', { name: 'Selection tools', exact: true });
  const viewport = page.locator('app-a4-canvas:not(.inactive) .preview-viewport');
  const pageControls = (await page
    .getByRole('navigation', { name: 'Pages', exact: true })
    .boundingBox())!;
  const layoutControls = (await page
    .getByRole('group', { name: 'Layout', exact: true })
    .boundingBox())!;
  expect(
    Math.abs(
      pageControls.y + pageControls.height / 2 - (layoutControls.y + layoutControls.height / 2),
    ),
  ).toBeLessThan(3);
  const toolBox = (await tools.boundingBox())!;
  const viewportBox = (await viewport.boundingBox())!;
  expect(toolBox.x).toBeGreaterThanOrEqual(viewportBox.x + viewportBox.width);
  const sheet = (await page.locator('app-a4-canvas:not(.inactive) .page').boundingBox())!;
  expect(toolBox.x).toBeGreaterThanOrEqual(sheet.x + sheet.width);
  const canvas = (await page.locator('app-a4-canvas:not(.inactive)').boundingBox())!;
  expect(viewportBox.height).toBeCloseTo(canvas.height, 0);
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('December 2026');
  await page.screenshot({ path: testInfo.outputPath('compact-desktop.png') });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('tab', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toBeVisible();
  const mobileViewport = (await viewport.boundingBox())!;
  const mobileCanvas = (await page.locator('app-a4-canvas:not(.inactive)').boundingBox())!;
  expect(mobileViewport.height).toBeCloseTo(mobileCanvas.height, 0);
  const mobileTools = (await tools.boundingBox())!;
  expect(mobileTools.x).toBeGreaterThanOrEqual(mobileCanvas.x);
  expect(mobileTools.x + mobileTools.width).toBeLessThanOrEqual(
    mobileCanvas.x + mobileCanvas.width,
  );
  expect(mobileTools.y + mobileTools.height).toBeLessThanOrEqual(
    mobileCanvas.y + mobileCanvas.height,
  );
  await page.screenshot({ path: testInfo.outputPath('compact-mobile.png') });
});


test('supports German browser defaults, captions, page controls and persisted language on mobile', async ({
  browser,
  page,
}, testInfo) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const germanPage = await context.newPage();
  try {
    await germanPage.goto(page.url());
    await expect(germanPage.locator('html')).toHaveAttribute('lang', 'de');
    await expect(germanPage.getByLabel('Sprache', { exact: true })).toHaveValue('de');
    await expect(
      germanPage.getByRole('button', { name: 'A4 drucken', exact: true }),
    ).toBeVisible();
    await expect(
      germanPage.getByRole('button', { name: 'Fotos auswählen', exact: true }),
    ).toBeVisible();
    await addPhoto(germanPage, 'Urlaub Dezember 2026.png', 'Fotos hinzufügen');
    await germanPage
      .getByRole('button', {
        name: 'Urlaub Dezember 2026.png im ausgewählten Rahmen platzieren',
        exact: true,
      })
      .click();
    await germanPage
      .getByRole('group', { name: 'Layout', exact: true })
      .getByRole('button', { name: 'Polaroid-Raster', exact: true })
      .click();
    await expect(germanPage.getByLabel('Bildunterschrift', { exact: true })).toHaveValue(
      'Dezember 2026',
    );
    await germanPage.getByLabel('Sprache', { exact: true }).selectOption('en');
    await expect(germanPage.getByLabel('Subtitle', { exact: true })).toHaveValue(
      'December 2026',
    );
    await germanPage.getByLabel('Language', { exact: true }).selectOption('de');
    await germanPage.getByRole('button', { name: 'Seite hinzufügen', exact: true }).click();
    await expect(
      germanPage.getByRole('group', { name: 'Aktuelle Seite · 2', exact: true }),
    ).toBeVisible();
    await germanPage.getByRole('button', { name: 'Vorherige Seite', exact: true }).click();
    await germanPage.getByLabel('Bildunterschrift', { exact: true }).fill('Weihnachten');
    await germanPage.getByRole('button', { name: 'Fertig', exact: true }).click();
    await germanPage.reload();
    await expect(germanPage.getByLabel('Sprache', { exact: true })).toHaveValue('de');
    await expect(germanPage.getByLabel('Bildunterschrift', { exact: true })).toHaveValue(
      'Weihnachten',
    );
    for (const size of [
      { width: 1440, height: 900 },
      { width: 375, height: 667 },
    ]) {
      await germanPage.setViewportSize(size);
      if (size.width <= 700)
        await germanPage.getByRole('tab', { name: 'Bearbeiten', exact: true }).click();
      await expect(germanPage.getByLabel('Bildunterschrift', { exact: true })).toBeVisible();
      await expect
        .poll(() =>
          germanPage.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.documentElement.scrollHeight <= innerHeight,
          ),
        )
        .toBe(true);
      await germanPage.screenshot({ path: testInfo.outputPath(`german-${size.width}.png`) });
    }
    await germanPage.getByRole('button', { name: 'Projekt', exact: true }).click();
    await expect(
      germanPage.getByRole('button', { name: 'Projektdatei speichern', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
