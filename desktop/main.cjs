const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol } = require('electron');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'collage://app';
const webRoot = path.join(__dirname, 'web');
let window;
if (process.env.NESY_COLLAGE_USER_DATA)
  app.setPath('userData', process.env.NESY_COLLAGE_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: 'collage', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function createWindow() {
  window = new BrowserWindow({
    title: 'nesy-collage',
    width: 1440,
    height: 960,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#e8ebef',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== `${origin}/index.html`) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  await window.loadURL(`${origin}/index.html`);
}

app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    protocol.handle('collage', (request) => {
      try {
        const url = new URL(request.url);
        if (url.host !== 'app' || !['GET', 'HEAD'].includes(request.method))
          return new Response('Not found', { status: 404 });
        const file = path.resolve(webRoot, `.${decodeURIComponent(url.pathname)}`);
        const relative = path.relative(webRoot, file);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
          return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(file).href);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    ipcMain.handle('save-project', async (event, project) => {
      if (event.sender !== window?.webContents || typeof project !== 'string')
        throw new Error('Invalid project save request.');
      const result = await dialog.showSaveDialog(window, {
        defaultPath: 'collage-layout.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePath)
        await writeFile(result.filePath, project, 'utf8');
    });
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error) => {
    dialog.showErrorBox('nesy-collage', error.message);
    app.quit();
  });

app.on('window-all-closed', () => app.quit());
