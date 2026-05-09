const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:   () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readFile:   (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  saveFile:   (filePath, content) => ipcRenderer.invoke('fs:save-file', filePath, content),
  saveAs:     (defaultName) => ipcRenderer.invoke('dialog:save-as', defaultName),
  onMenuEvent:  (channel, callback) => {
    const valid = ['menu:new-file','menu:open-file','menu:open-folder','menu:save-as','menu:find','menu:replace','menu:toggle-sidebar','menu:toggle-theme','menu:toggle-column','menu:toggle-autocomplete','menu:toggle-wordwrap']
    if (valid.includes(channel)) ipcRenderer.on(channel, callback)
  },
  offMenuEvent: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },
  platform: process.platform,
})
