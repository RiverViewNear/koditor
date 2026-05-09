import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useEditorStore } from './hooks/useEditorStore'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import { useSessionStore } from './hooks/useSessionStore'
import { useSettings } from './hooks/useSettings'
import { useToast } from './hooks/useToast'
import { Login } from './components/Login'
import { Toast } from './components/Toast'
import {
  openFile, saveFileAs,
  getLanguage, onMenuEvent, isElectron,
  openFolder, type FolderEntry,
} from './utils/platform'
import './styles/app.css'

const RECENT_KEY = 'koditor:recentFiles'
const MAX_RECENT = 10
interface RecentFile { name: string; path: string }
function loadRecent(): RecentFile[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function saveRecent(list: RecentFile[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}
function pushRecent(name: string, path: string) {
  if (!path) return
  const list = loadRecent().filter(r => r.path !== path)
  saveRecent([{ name, path }, ...list])
}

export default function App() {
  const {
    tabs, activeId, activeTab,
    setActiveId, restoreTabs, openNewTab, openFileAsTab,
    updateContent, renameTab, markSaved, closeTab,
  } = useEditorStore()

  const { user, loading, signIn, signOut } = useAuth()
  const { toasts, removeToast, toast }     = useToast()
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  // ── 설정 (Firebase, 깜빡임 없이) ─────────────────────────
  const { settings, loaded: settingsLoaded, updateSetting } = useSettings(user)
  const { autoComplete, darkMode, columnMode, sidebarOpen } = settings

  // ── UI 상태 ───────────────────────────────────────────────
  const [openMenu,     setOpenMenu]     = useState<string | null>(null)
  const [folderName,   setFolderName]   = useState<string | null>(null)
  const [folderTree,   setFolderTree]   = useState<FolderEntry[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [recentFiles,  setRecentFiles]  = useState<RecentFile[]>(loadRecent)
  const [syncStatus,   setSyncStatus]   = useState<'saved' | 'saving' | 'offline' | 'error'>('saved')
  const [cursorInfo,   setCursorInfo]   = useState({ line: 1, col: 1, selected: 0, total: 0 })

  // ── 탭 이름 변경 상태 ─────────────────────────────────────
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName,  setEditingName]  = useState('')
  const tabInputRef = useRef<HTMLInputElement | null>(null)

  // ── 세션 복원 ─────────────────────────────────────────────
  const { sessionLoaded, removeTabDoc, saveSessionNow } = useSessionStore({
    user: user!,
    tabs,
    activeId,
    onSessionLoaded: restoreTabs,
  })

  // ── Firebase 실시간 동기화 ────────────────────────────────
  const { syncToRemote } = useSync({
    user: user!,
    docId: activeId,
    content: activeTab?.content ?? '',
    onRemoteChange: useCallback((remoteContent: string) => {
      updateContent(activeId, remoteContent)
      const model = editorRef.current?.getModel()
      if (model && model.getValue() !== remoteContent) {
        editorRef.current?.executeEdits('remote', [{
          range: model.getFullModelRange(),
          text: remoteContent,
        }])
      }
    }, [activeId, updateContent]),
  })

  const handleContentChange = useCallback((value: string) => {
    updateContent(activeId, value)
    if (user) {
      setSyncStatus('saving')
      syncToRemote(value)
      setTimeout(() => setSyncStatus('saved'), 600)
    }
  }, [activeId, updateContent, user, syncToRemote])

  // ── 다크모드 body 클래스 ──────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
  }, [darkMode])

  // ── 네트워크 상태 감지 ────────────────────────────────────
  useEffect(() => {
    const online = () => {
      setSyncStatus('saved')
      toast.info('온라인 상태로 복구됐어요. 변경사항을 동기화합니다.')
    }
    const offline = () => {
      setSyncStatus('offline')
      toast.warning('오프라인 상태입니다. 내용은 로컬에 저장됩니다.')
    }
    window.addEventListener('online',  online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online',  online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  // ── 메뉴 외부 클릭 닫기 ──────────────────────────────────
  useEffect(() => {
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // ── 탭 이름 편집 포커스 ───────────────────────────────────
  useEffect(() => {
    if (editingTabId && tabInputRef.current) {
      tabInputRef.current.focus()
      tabInputRef.current.select()
    }
  }, [editingTabId])

  // ── 탭 이름 편집 핸들러 ───────────────────────────────────
  const handleTabDoubleClick = useCallback((tabId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTabId(tabId)
    setEditingName(currentName)
  }, [])

  const handleTabRenameCommit = useCallback(() => {
    if (editingTabId) {
      renameTab(editingTabId, editingName || 'untitled.txt')
      // 탭 이름 변경 시 즉시 저장
      saveSessionNow()
    }
    setEditingTabId(null)
    setEditingName('')
  }, [editingTabId, editingName, renameTab, saveSessionNow])

  const handleTabRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  handleTabRenameCommit()
    if (e.key === 'Escape') { setEditingTabId(null); setEditingName('') }
  }, [handleTabRenameCommit])

  // ── 토글 ──────────────────────────────────────────────────
  const toggleColumnMode = useCallback(() => {
    const next = !columnMode
    editorRef.current?.updateOptions({ columnSelection: next })
    editorRef.current?.focus()
    updateSetting('columnMode', next)
  }, [columnMode, updateSetting])

  const toggleAutoComplete = useCallback(() => {
    const next = !autoComplete
    editorRef.current?.updateOptions({
      quickSuggestions: next ? { other: true, comments: false, strings: false } : false,
      suggestOnTriggerCharacters: next,
      parameterHints: { enabled: next },
      wordBasedSuggestions: next ? 'currentDocument' : 'off',
    })
    editorRef.current?.focus()
    updateSetting('autoComplete', next)
  }, [autoComplete, updateSetting])

  // ── 파일 열기 ──────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    setOpenMenu(null)
    try {
      const result = await openFile()
      if (!result) return
      openFileAsTab(result.name, result.path, result.content, getLanguage(result.name))
      pushRecent(result.name, result.path)
      setRecentFiles(loadRecent())
    } catch {
      toast.error('파일을 열 수 없습니다.')
    }
  }, [openFileAsTab])

  const handleOpenRecent = useCallback(async (recent: RecentFile) => {
    setOpenMenu(null)
    if (isElectron()) {
      const result = await window.electronAPI!.openFile()
      if (!result) return
      openFileAsTab(result.name, result.path, result.content, getLanguage(result.name))
    } else {
      toast.info(`웹 환경에서는 파일을 다시 선택해야 합니다. (${recent.name})`)
    }
  }, [openFileAsTab])

  const handleOpenFolder = useCallback(async () => {
    setOpenMenu(null)
    try {
      const result = await openFolder()
      if (!result) return
      setFolderName(result.name)
      setFolderTree(result.entries)
      updateSetting('sidebarOpen', true)
    } catch {
      toast.error('폴더를 열 수 없습니다.')
    }
  }, [updateSetting])

  // ── 로컬 파일로 내보내기 (Electron 전용) ──────────────────
  const handleSaveAs = useCallback(async () => {
    setOpenMenu(null)
    if (!activeTab) return
    try {
      const result = await saveFileAs(activeTab.content, activeTab.name)
      if (result.success && result.path) {
        const newName = result.path.split(/[\\/]/).pop() ?? activeTab.name
        markSaved(activeId, result.path, newName)
        pushRecent(newName, result.path)
        setRecentFiles(loadRecent())
      }
    } catch {
      toast.error('파일 내보내기에 실패했습니다.')
    }
  }, [activeTab, activeId, markSaved])

  // ── 탭 닫기 ───────────────────────────────────────────────
  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      if (!window.confirm(`"${tab.name}"에 저장하지 않은 변경사항이 있습니다.\n닫으시겠습니까?`)) return
    }
    closeTab(tabId, (id) => removeTabDoc(id))
  }, [tabs, closeTab, removeTabDoc])

  // ── 사이드바 파일 클릭 ────────────────────────────────────
  const handleFileClick = useCallback(async (entry: FolderEntry) => {
    if (entry.kind === 'directory') {
      setExpandedDirs(prev => {
        const next = new Set(prev)
        next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path)
        return next
      })
      return
    }
    try {
      const content = await entry.read!()
      openFileAsTab(entry.name, entry.path, content, getLanguage(entry.name))
    } catch {
      toast.error('파일을 읽을 수 없습니다.')
    }
  }, [openFileAsTab])

  // ── Electron 메뉴 ─────────────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return
    const offs = [
      onMenuEvent('menu:new-file',           openNewTab),
      onMenuEvent('menu:open-file',          handleOpen),
      onMenuEvent('menu:open-folder',        handleOpenFolder),
      onMenuEvent('menu:save-as',            handleSaveAs),
      onMenuEvent('menu:find',               () => editorRef.current?.trigger('', 'actions.find', null)),
      onMenuEvent('menu:replace',            () => editorRef.current?.trigger('', 'editor.action.startFindReplaceAction', null)),
      onMenuEvent('menu:toggle-sidebar',     () => updateSetting('sidebarOpen', !sidebarOpen)),
      onMenuEvent('menu:toggle-theme',       () => updateSetting('darkMode', !darkMode)),
      onMenuEvent('menu:toggle-column',      toggleColumnMode),
      onMenuEvent('menu:toggle-autocomplete',toggleAutoComplete),
      onMenuEvent('menu:toggle-wordwrap',    () => {
        const cur = editorRef.current?.getOption(130 as Monaco.editor.EditorOption)
        editorRef.current?.updateOptions({ wordWrap: cur === 'off' ? 'on' : 'off' })
      }),
      onMenuEvent('menu:sign-out', signOut),
    ]
    return () => offs.forEach(off => off())
  }, [openNewTab, handleOpen, handleOpenFolder, handleSaveAs, sidebarOpen, darkMode, toggleColumnMode, toggleAutoComplete, updateSetting, signOut])

  // ── Monaco 마운트 ──────────────────────────────────────────
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    if (!isElectron()) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, openNewTab)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, handleOpen)
    } else {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, handleSaveAs)
    }
    const updateCursor = () => {
      const pos      = editor.getPosition()
      const model    = editor.getModel()
      const sel      = editor.getSelection()
      const selected = sel && model ? model.getValueInRange(sel).length : 0
      const total    = model?.getValue().length ?? 0
      setCursorInfo({ line: pos?.lineNumber ?? 1, col: pos?.column ?? 1, selected, total })
    }
    editor.onDidChangeCursorPosition(updateCursor)
    editor.onDidChangeModelContent(updateCursor)
    editor.onDidChangeCursorSelection(updateCursor)
    updateCursor()
    editor.focus()
  }

  // ── 드롭다운 메뉴 ─────────────────────────────────────────
  const menus = [
    {
      id: 'file', label: '파일',
      items: [
        { label: '새 파일',     shortcut: 'Ctrl+N', action: () => { openNewTab(); setOpenMenu(null) } },
        { label: '파일 열기...', shortcut: 'Ctrl+O', action: handleOpen },
        { label: '폴더 열기...', shortcut: '',       action: handleOpenFolder },
        ...(isElectron() ? [
          { type: 'sep' },
          { label: '로컬 파일로 내보내기...', shortcut: 'Ctrl+Shift+S', action: handleSaveAs },
        ] : []),
        ...(recentFiles.length > 0 ? [
          { type: 'sep' },
          { label: '최근 파일', shortcut: '', action: () => {}, disabled: true },
          ...recentFiles.slice(0, 5).map(r => ({
            label: r.name, shortcut: '', action: () => handleOpenRecent(r), isRecent: true,
          })),
        ] : []),
      ],
    },
    {
      id: 'edit', label: '편집',
      items: [
        { label: '실행 취소', shortcut: 'Ctrl+Z', action: () => { editorRef.current?.trigger('', 'undo', null); setOpenMenu(null) } },
        { label: '다시 실행', shortcut: 'Ctrl+Y', action: () => { editorRef.current?.trigger('', 'redo', null); setOpenMenu(null) } },
        { type: 'sep' },
        { label: '잘라내기', shortcut: 'Ctrl+X', action: () => { editorRef.current?.trigger('', 'editor.action.clipboardCutAction', null); setOpenMenu(null) } },
        { label: '복사',     shortcut: 'Ctrl+C', action: () => { editorRef.current?.trigger('', 'editor.action.clipboardCopyAction', null); setOpenMenu(null) } },
        { label: '붙여넣기', shortcut: 'Ctrl+V', action: () => { editorRef.current?.trigger('', 'editor.action.clipboardPasteAction', null); setOpenMenu(null) } },
        { type: 'sep' },
        { label: '찾기',   shortcut: 'Ctrl+F', action: () => { editorRef.current?.trigger('', 'actions.find', null); setOpenMenu(null) } },
        { label: '바꾸기', shortcut: 'Ctrl+H', action: () => { editorRef.current?.trigger('', 'editor.action.startFindReplaceAction', null); setOpenMenu(null) } },
      ],
    },
    {
      id: 'view', label: '보기',
      items: [
        { label: `파일 탐색기 ${sidebarOpen ? '숨기기 ✓' : '보이기'}`, shortcut: '', action: () => { updateSetting('sidebarOpen', !sidebarOpen); setOpenMenu(null) } },
        { type: 'sep' },
        { label: `테마: ${darkMode ? '🌙 다크' : '☀️ 라이트'}`, shortcut: '', action: () => { updateSetting('darkMode', !darkMode); setOpenMenu(null) } },
        { type: 'sep' },
        { label: `열 블록 모드 ${columnMode ? '끄기 ✓' : '켜기'}`, shortcut: '', action: () => { toggleColumnMode(); setOpenMenu(null) } },
        { label: `자동완성 ${autoComplete ? '끄기 ✓' : '켜기'}`,   shortcut: '', action: () => { toggleAutoComplete(); setOpenMenu(null) } },
        { type: 'sep' },
        { label: '줄 바꿈 토글', shortcut: 'Alt+Z', action: () => {
          const cur = editorRef.current?.getOption(130 as Monaco.editor.EditorOption)
          editorRef.current?.updateOptions({ wordWrap: cur === 'off' ? 'on' : 'off' })
          setOpenMenu(null)
        }},
      ],
    },
    {
      id: 'account', label: user ? '계정' : '로그인',
      items: user ? [
        { label: user.displayName ?? user.email ?? '내 계정', shortcut: '', action: () => {}, disabled: true },
        { type: 'sep' },
        { label: '로그아웃', shortcut: '', action: () => { signOut(); setOpenMenu(null) } },
      ] : [
        { label: 'Google로 로그인', shortcut: '', action: () => { signIn(); setOpenMenu(null) } },
      ],
    },
  ]

  // ── 파일 트리 렌더 ────────────────────────────────────────
  const renderTree = (entries: FolderEntry[], depth = 0): React.ReactNode =>
    entries.map(entry => (
      <div key={entry.path}>
        <div
          className={`tree-item tree-item--${entry.kind}`}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          onClick={() => handleFileClick(entry)}
          title={entry.path}
        >
          <span className="tree-icon">
            {entry.kind === 'directory'
              ? (expandedDirs.has(entry.path) ? '▾' : '▸')
              : fileIcon(entry.name)}
          </span>
          <span className="tree-name">{entry.name}</span>
        </div>
        {entry.kind === 'directory' && expandedDirs.has(entry.path) && entry.children &&
          renderTree(entry.children, depth + 1)
        }
      </div>
    ))

  // ── 로딩 / 로그인 화면 ────────────────────────────────────
  if (loading)                              return <div className="app-loading">로딩 중...</div>
  if (!user)                                return <Login onSignIn={signIn} />
  if (!sessionLoaded || !settingsLoaded)    return <div className="app-loading">이전 작업 불러오는 중...</div>

  return (
    <div className={`app ${darkMode ? 'app--dark' : ''}`}>

      {!isElectron() && (
        <header className="menubar">
          <span className="menubar-brand">Koditor</span>
          <nav className="menubar-nav" onClick={e => e.stopPropagation()}>
            {menus.map(menu => (
              <div key={menu.id} className="dropdown">
                <button
                  className={`dropdown__trigger ${openMenu === menu.id ? 'dropdown__trigger--open' : ''}`}
                  onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                >
                  {menu.id === 'account' && user?.photoURL &&
                    <img src={user.photoURL} alt="" className="menubar-avatar" />
                  }
                  {menu.label}
                </button>
                {openMenu === menu.id && (
                  <div className="dropdown__panel">
                    {menu.items.map((item: any, i) =>
                      item.type === 'sep'
                        ? <div key={i} className="dropdown__sep" />
                        : (
                          <button
                            key={i}
                            className={`dropdown__item ${item.disabled ? 'dropdown__item--header' : ''} ${item.isRecent ? 'dropdown__item--recent' : ''}`}
                            onClick={item.disabled ? undefined : item.action}
                            disabled={item.disabled}
                          >
                            <span>{item.label}</span>
                            {item.shortcut && <kbd>{item.shortcut}</kbd>}
                          </button>
                        )
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="menubar-badges">
            {columnMode    && <span className="badge badge--blue">열 블록</span>}
            {!autoComplete && <span className="badge badge--gray">자동완성 OFF</span>}
          </div>
        </header>
      )}

      <div className="tabbar">
        <div className="tabs-track">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeId ? 'tab--active' : ''}`}
              onClick={() => setActiveId(tab.id)}
              title="더블클릭으로 이름 변경"
            >
              <span className={`tab__dot tab__dot--${tab.language}`} />
              {editingTabId === tab.id ? (
                <input
                  ref={tabInputRef}
                  className="tab__name-input"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={handleTabRenameCommit}
                  onKeyDown={handleTabRenameKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="tab__name"
                  onDoubleClick={e => handleTabDoubleClick(tab.id, tab.name, e)}
                >
                  {tab.name}
                </span>
              )}
              <button className="tab__close" onClick={e => handleCloseTab(tab.id, e)}>×</button>
            </div>
          ))}
        </div>
        <button className="tabbar__add" onClick={openNewTab} title="새 탭 (Ctrl+N)">+</button>
      </div>

      <div className="workspace">
        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar__header">
              <span className="sidebar__title">{folderName ?? '탐색기'}</span>
              <button className="sidebar__btn" onClick={handleOpenFolder}>
                {folderName ? '↺' : '열기'}
              </button>
            </div>
            <div className="sidebar__tree">
              {folderTree.length === 0
                ? <p className="sidebar__empty">폴더를 열면<br />파일 목록이 표시됩니다</p>
                : renderTree(folderTree)
              }
            </div>
          </aside>
        )}

        <div className="editor-wrap">
          <Editor
            key={activeId}
            value={activeTab?.content ?? ''}
            language={activeTab?.language ?? 'plaintext'}
            theme={darkMode ? 'vs-dark' : 'vs'}
            loading={<div className="editor-loading">에디터 로딩 중...</div>}
            options={{
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 14, lineHeight: 22, letterSpacing: 0.3, fontLigatures: true,
              lineNumbers: 'on', lineNumbersMinChars: 4, lineDecorationsWidth: 8, glyphMargin: false,
              columnSelection: columnMode,
              multiCursorModifier: 'ctrlCmd',
              minimap: { enabled: true, scale: 1, renderCharacters: false },
              scrollBeyondLastLine: false, smoothScrolling: true,
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              tabSize: 2, insertSpaces: true, detectIndentation: true,
              quickSuggestions: autoComplete ? { other: true, comments: false, strings: false } : false,
              suggestOnTriggerCharacters: autoComplete,
              parameterHints: { enabled: autoComplete },
              wordBasedSuggestions: autoComplete ? 'currentDocument' : 'off',
              autoClosingBrackets: 'always', autoClosingQuotes: 'always',
              autoIndent: 'full', formatOnPaste: true,
              cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on',
              renderWhitespace: 'none', rulers: [], roundedSelection: false,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              folding: true, foldingHighlight: true,
              selectionHighlight: false, occurrencesHighlight: 'off',
              wordWrap: 'off', accessibilitySupport: 'off',
            }}
            onMount={handleEditorMount}
            onChange={value => handleContentChange(value ?? '')}
          />
        </div>
      </div>

      <footer className="statusbar">
        <div className="statusbar__left">
          <span className="status-pill">{activeTab?.language ?? 'plaintext'}</span>
          <span className="status-sep">│</span>
          <span className={`status-pill ${
            syncStatus === 'offline' ? 'status-pill--dirty' :
            syncStatus === 'error'   ? 'status-pill--dirty' :
            syncStatus === 'saving'  ? 'status-pill--col'   : ''
          }`}>
            {syncStatus === 'offline' ? '● 오프라인' :
             syncStatus === 'error'   ? '● 동기화 오류' :
             syncStatus === 'saving'  ? '↑ 동기화 중...' :
             '✓ 동기화됨'}
          </span>
        </div>
        <div className="statusbar__right">
          {cursorInfo.selected > 0 && <>
            <span className="status-pill">선택 {cursorInfo.selected}자</span>
            <span className="status-sep">│</span>
          </>}
          <span className="status-pill">{cursorInfo.total.toLocaleString()}자</span>
          <span className="status-sep">│</span>
          <span className="status-pill">{cursorInfo.line}줄 {cursorInfo.col}열</span>
          <span className="status-sep">│</span>
          {columnMode    && <><span className="status-pill status-pill--col">열 블록</span><span className="status-sep">│</span></>}
          {!autoComplete && <><span className="status-pill status-pill--off">자동완성 OFF</span><span className="status-sep">│</span></>}
          <span className="status-pill">UTF-8</span>
        </div>
      </footer>

      {/* 토스트 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    js: 'JS', jsx: 'JS', ts: 'TS', tsx: 'TS',
    html: 'HT', htm: 'HT', css: 'CS', java: 'JV', txt: '—',
  }
  return map[ext ?? ''] ?? '·'
}
