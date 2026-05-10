const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const http  = require('http')
const Store = require('electron-store')

const store = new Store()

const isDev   = process.env.NODE_ENV === 'development' || !app.isPackaged
const DEV_URL = 'http://localhost:1420'

let mainWindow    = null
let localServer   = null
const LOCAL_PORT  = 9123

function startLocalServer(distPath) {
  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url)
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, 'index.html')
      }
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes = {
        '.html': 'text/html', '.js': 'application/javascript',
        '.css': 'text/css',   '.json': 'application/json',
        '.png': 'image/png',  '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon', '.woff2': 'font/woff2',
      }
      try {
        const data = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${LOCAL_PORT}`)
    })
  })
}

function createWindow() {
  const bounds      = store.get('windowBounds', { width: 1280, height: 800 })
  const wasMaximized = store.get('windowMaximized', false)

  mainWindow = new BrowserWindow({
    width:     bounds.width,
    height:    bounds.height,
    x:         bounds.x,
    y:         bounds.y,
    minWidth:  800,
    minHeight: 500,
    title: 'Pumice',
    show: false,  // 스플래시 준비 완료 후 표시
    backgroundColor: '#f5f5f0',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:main',
    },
  })

  // 창 닫힐 때 크기/위치/최대화 저장
  mainWindow.on('close', () => {
    store.set('windowMaximized', mainWindow.isMaximized())
    // 최대화 상태여도 복원 크기 저장 (최대화 해제 시 돌아올 크기)
    if (!mainWindow.isMinimized()) {
      const b = mainWindow.getNormalBounds()
      store.set('windowBounds', { width: b.width, height: b.height, x: b.x, y: b.y })
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500, height: 700,
          autoHideMenuBar: true, menuBarVisible: false,
          webPreferences: { contextIsolation: true, nodeIntegration: false, partition: 'persist:main' },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
      if (wasMaximized) mainWindow.maximize()
    })
  } else {
    // 1) 스플래시 HTML 인라인 (파일 의존성 없음)
    const splashHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f5f5f0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.name{font-size:22px;font-weight:500;color:#aaa;letter-spacing:0.5px;margin-bottom:16px}
.dots{display:flex;gap:6px}
.dot{width:6px;height:6px;border-radius:50%;background:#aaa;animation:p 1.2s ease-in-out infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes p{0%,80%,100%{opacity:.2}40%{opacity:1}}
</style></head><body>
<div class="name">Pumice</div>
<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
</body></html>`

    // 2) 스플래시 렌더링 완료 시 창 표시 + 최대화
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.show()
      if (wasMaximized) mainWindow.maximize()
    })

    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml))

    // 3) 서버 준비되면 실제 앱 로드
    const distPath = path.join(__dirname, '../dist')
    startLocalServer(distPath).then((url) => {
      mainWindow.loadURL(url)
    })
  }

  buildMenu(mainWindow)
}

function buildMenu(win, state = {}) {
  const isMac        = process.platform === 'darwin'
  const userName     = state.userName     || null
  const sidebarOpen  = state.sidebarOpen  !== false
  const darkMode     = state.darkMode     || false
  const columnMode   = state.columnMode   || false
  const autoComplete = state.autoComplete !== false

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' }, { role: 'services' },
        { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' }, { role: 'quit' },
      ],
    }] : []),
    {
      label: '파일',
      submenu: [
        { label: '새 파일',                accelerator: 'CmdOrCtrl+N',       click: () => win.webContents.send('menu:new-file') },
        { label: '파일 열기...',            accelerator: 'CmdOrCtrl+O',       click: () => win.webContents.send('menu:open-file') },
        { label: '폴더 열기...',            accelerator: '',                   click: () => win.webContents.send('menu:open-folder') },
        { type: 'separator' },
        { label: '로컬 파일로 내보내기...', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '종료' },
      ],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '모두 선택' },
        { type: 'separator' },
        { label: '찾기',   accelerator: 'CmdOrCtrl+F', click: () => win.webContents.send('menu:find') },
        { label: '바꾸기', accelerator: 'CmdOrCtrl+H', click: () => win.webContents.send('menu:replace') },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: sidebarOpen  ? '파일 탐색기 숨기기 ✓' : '파일 탐색기 보이기', click: () => win.webContents.send('menu:toggle-sidebar') },
        { label: darkMode     ? '🌙 다크 테마 ✓'       : '☀️ 라이트 테마',     click: () => win.webContents.send('menu:toggle-theme') },
        { type: 'separator' },
        { label: columnMode   ? '열 블록 모드 끄기 ✓'  : '열 블록 모드 켜기',  click: () => win.webContents.send('menu:toggle-column') },
        { label: autoComplete ? '자동완성 끄기 ✓'      : '자동완성 켜기',      click: () => win.webContents.send('menu:toggle-autocomplete') },
        { label: '줄 바꿈 토글', accelerator: 'Alt+Z', click: () => win.webContents.send('menu:toggle-wordwrap') },
        { type: 'separator' },
        { label: '폰트 크기 확대',   accelerator: 'CmdOrCtrl+=', click: () => win.webContents.send('menu:font-increase') },
        { label: '폰트 크기 축소',   accelerator: 'CmdOrCtrl+-', click: () => win.webContents.send('menu:font-decrease') },
        { label: '폰트 크기 기본값', accelerator: 'CmdOrCtrl+0', click: () => win.webContents.send('menu:font-reset') },
        { type: 'separator' },
        { role: 'reload', label: '새로고침' },
        { type: 'separator' },
        { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { role: 'resetZoom', label: '기본 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: '개발자 도구' }] : []),
      ],
    },
    {
      label: '계정',
      submenu: [
        ...(userName ? [{ label: userName, enabled: false }, { type: 'separator' }] : []),
        { label: '로그아웃', click: () => win.webContents.send('menu:sign-out') },
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
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true } }
  catch (err) { return { success: false, error: String(err) } }
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

ipcMain.handle('dialog:open-file-encoding', async (_event, encoding) => {
  const iconv = require('iconv-lite')
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '지원 파일', extensions: ['txt','js','jsx','ts','tsx','html','htm','css','java'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const buf = fs.readFileSync(filePath)
  return { name: path.basename(filePath), path: filePath, content: iconv.decode(buf, encoding || 'utf-8') }
})

ipcMain.handle('fs:save-file-encoding', async (_event, filePath, content, encoding) => {
  try {
    const iconv = require('iconv-lite')
    fs.writeFileSync(filePath, iconv.encode(content, encoding || 'utf-8'))
    return { success: true }
  } catch (err) { return { success: false, error: String(err) } }
})

ipcMain.handle('dialog:save-as-encoding', async (_event, defaultName, content, encoding) => {
  const iconv = require('iconv-lite')
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: '지원 파일', extensions: ['txt','js','jsx','ts','tsx','html','htm','css','java'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePath) return null
  fs.writeFileSync(result.filePath, iconv.encode(content, encoding || 'utf-8'))
  return result.filePath
})

ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const folderPath = result.filePaths[0]
  return { name: path.basename(folderPath), path: folderPath, entries: readDirSync(folderPath) }
})

ipcMain.handle('fs:open-folder-by-path', async (_event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return null
    return { name: path.basename(folderPath), path: folderPath, entries: readDirSync(folderPath) }
  } catch { return null }
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
      if (supportedExts.includes(ext)) entries.push({ name: item.name, path: fullPath, kind: 'file' })
    }
  }
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

ipcMain.on('menu:update-state', (_event, state) => {
  if (mainWindow) buildMenu(mainWindow, state)
})

// ── 단일 인스턴스 잠금 ───────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  if (localServer) { localServer.close(); localServer = null }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
