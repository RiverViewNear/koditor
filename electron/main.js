const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const DEV_URL = 'http://localhost:1420'

// ── 창 생성 ───────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'Koditor',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  buildMenu(win)
  return win
}

// ── 네이티브 메뉴 ─────────────────────────────────────────
function buildMenu(win) {
  const isMac = process.platform === 'darwin'

  const template = [
    // macOS 앱 메뉴
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

    // 파일 메뉴
    {
      label: '파일',
      submenu: [
        {
          label: '새 파일',
          accelerator: 'CmdOrCtrl+N',
          click: () => win.webContents.send('menu:new-file'),
        },
        {
          label: '열기...',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send('menu:open-file'),
        },
        { type: 'separator' },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('menu:save'),
        },
        {
          label: '다른 이름으로 저장...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => win.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '종료' },
      ],
    },

    // 편집 메뉴
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
      ],
    },

    // 보기 메뉴
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { type: 'separator' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { role: 'resetZoom', label: '기본 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: '개발자 도구' },
        ] : []),
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ── IPC 핸들러 — 파일 시스템 ─────────────────────────────

// 파일 열기 다이얼로그
ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: '지원 파일',
        extensions: ['txt', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'java'],
      },
      { name: '텍스트', extensions: ['txt'] },
      { name: 'JavaScript', extensions: ['js', 'jsx'] },
      { name: 'TypeScript', extensions: ['ts', 'tsx'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'CSS', extensions: ['css'] },
      { name: 'Java', extensions: ['java'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  const name = path.basename(filePath)
  return { name, path: filePath, content }
})

// 파일 저장 (경로 있음 → 덮어쓰기)
ipcMain.handle('fs:save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

// 다른 이름으로 저장 다이얼로그
ipcMain.handle('dialog:save-as', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      {
        name: '지원 파일',
        extensions: ['txt', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'java'],
      },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) return null
  return result.filePath
})

// 파일 읽기 (사이드바 파일 클릭 시)
ipcMain.handle('fs:read-file', async (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8')
})

// 폴더 열기 다이얼로그
ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const name = path.basename(folderPath)
  const entries = readDirSync(folderPath)
  return { name, entries }
})

// 폴더 재귀 읽기 (Electron)
function readDirSync(dirPath, supportedExts = ['txt','js','jsx','ts','tsx','html','htm','css','java']) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  const entries = []

  for (const item of items) {
    // 숨김 파일/폴더 제외
    if (item.name.startsWith('.')) continue
    // node_modules 제외
    if (item.name === 'node_modules') continue

    const fullPath = path.join(dirPath, item.name)

    if (item.isDirectory()) {
      const children = readDirSync(fullPath, supportedExts)
      entries.push({ name: item.name, path: fullPath, kind: 'directory', children })
    } else {
      const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
      if (supportedExts.includes(ext)) {
        entries.push({ name: item.name, path: fullPath, kind: 'file' })
      }
    }
  }

  // 폴더 먼저, 이름순 정렬
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
