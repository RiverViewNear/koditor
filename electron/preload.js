const { contextBridge, ipcRenderer } = require('electron')

const VALID_CHANNELS = [
  'menu:new-file', 'menu:open-file', 'menu:open-folder', 'menu:save-as',
  'menu:find', 'menu:replace', 'menu:toggle-sidebar', 'menu:toggle-theme',
  'menu:toggle-column', 'menu:toggle-autocomplete', 'menu:toggle-wordwrap',
]

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:   () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readFile:   (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  saveFile:   (filePath, content) => ipcRenderer.invoke('fs:save-file', filePath, content),
  saveAs:     (defaultName) => ipcRenderer.invoke('dialog:save-as', defaultName),

  onMenuEvent: (channel, callback) => {
    if (!VALID_CHANNELS.includes(channel)) return
    // 등록 전에 기존 리스너 모두 제거 (중복 방지)
    ipcRenderer.removeAllListeners(channel)
    ipcRenderer.on(channel, callback)
  },
  offMenuEvent: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },

  platform: process.platform,
})
