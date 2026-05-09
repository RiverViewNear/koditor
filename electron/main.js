const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs   = require('fs')

const isDev   = process.env.NODE_ENV === 'development' || !app.isPackaged
const DEV_URL = 'http://localhost:1420'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'Koditor',
    show: false,
    backgroundColor: '#f5f5f0',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Google 로그인 팝업 — 메뉴 숨김 처리
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
          modal: true,
          parent: mainWindow,
          autoHideMenuBar: true,
          menuBarVisible: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    // 로컬 파일 로드 (외부 URL 로드 시 이벤트 리스너 중복 문제 방지)
    // 로그인은 팝업 방식으로 처리하므로 로컬 파일로도 정상 동작
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  buildMenu(mainWindow)
}

function buildMenu(win) {
  const isMac = process.platform === 'darwin'

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: '파일',
      submenu: [
        { label: '새 파일',               accelerator: 'CmdOrCtrl+N',       click: () => win.webContents.send('menu:new-file') },
        { label: '파일 열기...',           accelerator: 'CmdOrCtrl+O',       click: () => win.webContents.send('menu:open-file') },
        { label: '폴더 열기...',           accelerator: '',                   click: () => win.webContents.send('menu:open-folder') },
        { type: 'separator' },
        { label: '로컬 파일로 내보내기...', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '종료' },
      ],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo',      label: '실행 취소' },
        { role: 'redo',      label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut',       label: '잘라내기' },
        { role: 'copy',      label: '복사' },
        { role: 'paste',     label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
        { type: 'separator' },
        { label: '찾기',   accelerator: 'CmdOrCtrl+F', click: () => win.webContents.send('menu:find') },
        { label: '바꾸기', accelerator: 'CmdOrCtrl+H', click: () => win.webContents.send('menu:replace') },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '파일 탐색기 토글', click: () => win.webContents.send('menu:toggle-sidebar') },
        { label: '테마 전환',        click: () => win.webContents.send('menu:toggle-theme') },
        { label: '열 블록 모드 토글', click: () => win.webContents.send('menu:toggle-column') },
        { label: '자동완성 토글',    click: () => win.webContents.send('menu:toggle-autocomplete') },
        { label: '줄 바꿈 토글',    accelerator: 'Alt+Z', click: () => win.webContents.send('menu:toggle-wordwrap') },
        { type: 'separator' },
        { role: 'reload',           label: '새로고침' },
        { type: 'separator' },
        { role: 'zoomIn',           label: '확대' },
        { role: 'zoomOut',          label: '축소' },
        { role: 'resetZoom',        label: '기본 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: '개발자 도구' },
        ] : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC 핸들러 ────────────────────────────────────────────

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '지원 파일', extensions: ['txt','js','jsx','ts','tsx','html','htm','css','java'] },
      { name: '텍스트',     extensions: ['txt'] },
      { name: 'JavaScript', extensions: ['js','jsx'] },
      { name: 'TypeScript', extensions: ['ts','tsx'] },
      { name: 'HTML',       extensions: ['html','htm'] },
      { name: 'CSS',        extensions: ['css'] },
      { name: 'Java',       extensions: ['java'] },
      { name: '모든 파일',  extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  return { name: path.basename(filePath), path: filePath, content: fs.readFileSync(filePath, 'utf-8') }
})

ipcMain.handle('fs:save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('dialog:save-as', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: '지원 파일', extensions: ['txt','js','jsx','ts','tsx','html','htm','css','java'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
})

ipcMain.handle('fs:read-file', async (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const folderPath = result.filePaths[0]
  return { name: path.basename(folderPath), entries: readDirSync(folderPath) }
})

function readDirSync(dirPath, supportedExts = ['txt','js','jsx','ts','tsx','html','htm','css','java']) {
  const entries = []
  for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue
    const fullPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      entries.push({ name: item.name, path: fullPath, kind: 'directory', children: readDirSync(fullPath, supportedExts) })
    } else {
      const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
      if (supportedExts.includes(ext)) {
        entries.push({ name: item.name, path: fullPath, kind: 'file' })
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// ── 앱 라이프사이클 ───────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
