const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const http  = require('http')
const Store = require('electron-store')

// 창 크기/위치 저장소
const store = new Store()

const isDev   = process.env.NODE_ENV === 'development' || !app.isPackaged
const DEV_URL = 'http://localhost:1420'

let mainWindow    = null
let localServer   = null
const LOCAL_PORT  = 9123

// ── 로컬 정적 파일 서버 (file:// 대신 http://localhost 사용) ──
function startLocalServer(distPath) {
  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url)

      // SPA 라우팅: 파일 없으면 index.html
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
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      try {
        const data = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': contentType })
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
  // 마지막 창 크기/위치 복원 (없으면 기본값)
  const bounds = store.get('windowBounds', { width: 1280, height: 800 })

  mainWindow = new BrowserWindow({
    width:     bounds.width,
    height:    bounds.height,
    x:         bounds.x,
    y:         bounds.y,
    minWidth:  800,
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
      partition: 'persist:main',
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // mainWindow.webContents.openDevTools()
    // 최대화 상태 복원
    if (store.get('windowMaximized', false)) {
      mainWindow.maximize()
    }
  })

  // 창 닫히기 전 크기/위치 저장
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      store.set('windowBounds', mainWindow.getBounds())
    }
    store.set('windowMaximized', mainWindow.isMaximized())
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })



  // Google 로그인 팝업
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 700,
          autoHideMenuBar: true,
          menuBarVisible: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            partition: 'persist:main',
          },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 팝업 창에도 DevTools 열기 (디버깅용)
  // app.on('browser-window-created', (_, window) => {
  //   if (window !== mainWindow) {
  //     window.webContents.openDevTools()
  //   }
  // })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    // http://127.0.0.1:9123 으로 로드 — file://은 Firebase 인증 불가
    // localhost는 Firebase 승인된 도메인에 기본 등록되어 있음
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
        { label: sidebarOpen  ? '파일 탐색기 숨기기 ✓' : '파일 탐색기 보이기', click: () => win.webContents.send('menu:toggle-sidebar') },
        { label: darkMode     ? '🌙 다크 테마 ✓'       : '☀️ 라이트 테마',     click: () => win.webContents.send('menu:toggle-theme') },
        { type: 'separator' },
        { label: columnMode   ? '열 블록 모드 끄기 ✓'  : '열 블록 모드 켜기',  click: () => win.webContents.send('menu:toggle-column') },
        { label: autoComplete ? '자동완성 끄기 ✓'      : '자동완성 켜기',      click: () => win.webContents.send('menu:toggle-autocomplete') },
        { label: '줄 바꿈 토글', accelerator: 'Alt+Z',  click: () => win.webContents.send('menu:toggle-wordwrap') },
        { type: 'separator' },
        { role: 'reload',            label: '새로고침' },
        { type: 'separator' },
        { role: 'zoomIn',            label: '확대' },
        { role: 'zoomOut',           label: '축소' },
        { role: 'resetZoom',         label: '기본 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen',  label: '전체 화면' },
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools',  label: '개발자 도구' },
        ] : []),
      ],
    },
    {
      label: '계정',
      submenu: [
        ...(userName ? [
          { label: userName, enabled: false },
          { type: 'separator' },
        ] : []),
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
  return { name: path.basename(folderPath), path: folderPath, entries: readDirSync(folderPath) }
})

// 경로로 직접 폴더 열기 (앱 재시작 시 마지막 폴더 복원용)
ipcMain.handle('fs:open-folder-by-path', async (_event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return null
    return { name: path.basename(folderPath), path: folderPath, entries: readDirSync(folderPath) }
  } catch {
    return null
  }
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

// ── 상태 변경 시 메뉴 재빌드 ────────────────────────────────
ipcMain.on('menu:update-state', (_event, state) => {
  if (mainWindow) buildMenu(mainWindow, state)
})

// ── 앱 라이프사이클 ───────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 앱 종료 전 로컬 서버 반드시 종료
app.on('before-quit', () => {
  if (localServer) {
    localServer.close()
    localServer = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
