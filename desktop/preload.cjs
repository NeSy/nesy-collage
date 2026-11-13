const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveProject: (project) => ipcRenderer.invoke('save-project', project),
});
