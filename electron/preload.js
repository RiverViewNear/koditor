/**
 * preload.js
 *
 * 보안 브릿지: Electron 메인 프로세스 ↔ React 렌더러
 * contextIsolation: true 상태에서 안전하게 IPC 노출
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 파일 열기 다이얼로그
  openFile: () => ipcRenderer.invoke('dialog:open-file'),

  // 폴더 열기 다이얼로그
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),

  // 파일 읽기
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),

  // 파일 저장 (덮어쓰기)
  saveFile: (filePath, content) =>
    ipcRenderer.invoke('fs:save-file', filePath, content),

  // 다른 이름으로 저장 다이얼로그
  saveAs: (defaultName) =>
    ipcRenderer.invoke('dialog:save-as', defaultName),

  // 메뉴 이벤트 수신 (네이티브 메뉴 → React)
  onMenuEvent: (channel, callback) => {
    const validChannels = [
      'menu:new-file',
      'menu:open-file',
      'menu:save',
      'menu:save-as',
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback)
    }
  },

  // 메뉴 이벤트 리스너 해제
  offMenuEvent: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },

  // 플랫폼 정보
  platform: process.platform,
})
