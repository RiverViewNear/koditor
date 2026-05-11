import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from './hooks/useEditorStore'
import type { Tab } from './hooks/useEditorStore'
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
  openFolder, openFolderByPath, type FolderEntry,
} from './utils/platform'
import './styles/app.css'

// ── 최근 파일 ─────────────────────────────────────────────
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

// ── 인코딩 목록 ───────────────────────────────────────────
const ENCODINGS = ['UTF-8', 'EUC-KR', 'UTF-16LE', 'UTF-16BE', 'CP949']

// ── 드래그 가능한 탭 컴포넌트 ─────────────────────────────
function SortableTab({
  tab, isActive, isEditing, editingName,
  onActivate, onDoubleClick, onClose,
  onEditChange, onEditCommit, onEditKeyDown,
  inputRef,
}: {
  tab: Tab
  isActive: boolean
  isEditing: boolean
  editingName: string
  onActivate: () => void
  onDoubleClick: (e: React.MouseEvent) => void
  onClose: (e: React.MouseEvent) => void
  onEditChange: (v: string) => void
  onEditCommit: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tab ${isActive ? 'tab--active' : ''}`}
      onClick={onActivate}
      title="더블클릭으로 이름 변경"
      {...attributes}
      {...listeners}
    >
      <span className={`tab__dot tab__dot--${tab.language}`} />
      {isEditing ? (
        <input
          ref={inputRef}
          className="tab__name-input"
          value={editingName}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onEditCommit}
          onKeyDown={onEditKeyDown}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="tab__name" onDoubleClick={onDoubleClick}>{tab.name}</span>
      )}
      <button className="tab__close" onClick={onClose}>×</button>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function App() {
  const {
    tabs, activeId, activeTab,
    setActiveId, restoreTabs, openNewTab, openFileAsTab,
    updateContent, renameTab, reorderTabs, markSaved, closeTab,
  } = useEditorStore()

  const { user, loading, signIn, signOut } = useAuth()
  const { toasts, removeToast, toast }     = useToast()
  const editorRef    = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const tabInputRef  = useRef<HTMLInputElement>(null)


  const { settings, loaded: settingsLoaded, updateSetting } = useSettings(user)
  const { autoComplete, darkMode, columnMode, sidebarOpen, fontSize, encoding, wordWrap } = settings

  // ── UI 상태 ───────────────────────────────────────────────
  const [openMenu,      setOpenMenu]      = useState<string | null>(null)

  // 메뉴 닫을 때 에디터 포커스 복원
  const [folderName,    setFolderName]    = useState<string | null>(null)
  const [folderTree,    setFolderTree]    = useState<FolderEntry[]>([])
  const [expandedDirs,  setExpandedDirs]  = useState<Set<string>>(new Set())
  const [recentFiles,   setRecentFiles]   = useState<RecentFile[]>(loadRecent)
  const [syncStatus,    setSyncStatus]    = useState<'saved' | 'saving' | 'offline' | 'error'>('saved')
  const [cursorInfo,    setCursorInfo]    = useState({ line: 1, col: 1, selected: 0, total: 0 })
  const [editingTabId,  setEditingTabId]  = useState<string | null>(null)
  const [editingName,   setEditingName]   = useState('')
  const [showEncMenu,   setShowEncMenu]   = useState(false)

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
        editorRef.current?.executeEdits('remote', [{ range: model.getFullModelRange(), text: remoteContent }])
      }
    }, [activeId, updateContent]),
  })

  const handleContentChange = useCallback((value: string) => {
    updateContent(activeId, value)
    if (user) {
      setSyncStatus('saving')
      syncToRemote(value)
      setTimeout(() => {
        setSyncStatus('saved')
        // Firebase 저장 완료 후 isDirty 초기화
        markSaved(activeId)
      }, 600)
    }
  }, [activeId, updateContent, user, syncToRemote, markSaved])

  // ── 다크모드 ──────────────────────────────────────────────
  useEffect(() => { document.body.classList.toggle('dark', darkMode) }, [darkMode])

  // ── 줄 바꿈 상태 변경 시 에디터 즉시 반영 ────────────────
  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' })
  }, [wordWrap])

  // ── 네트워크 ──────────────────────────────────────────────
  useEffect(() => {
    const online  = () => { setSyncStatus('saved');   toast.info('온라인 상태로 복구됐어요.') }
    const offline = () => { setSyncStatus('offline'); toast.warning('오프라인 상태입니다.') }
    window.addEventListener('online',  online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])

  // ── 메뉴 외부 클릭 닫기 ──────────────────────────────────
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.enc-menu'))  setShowEncMenu(false)
      if (!target.closest('.dropdown'))  setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // ── 탭 이름 편집 포커스 ───────────────────────────────────
  useEffect(() => {
    if (editingTabId && tabInputRef.current) {
      tabInputRef.current.focus()
      tabInputRef.current.select()
    }
  }, [editingTabId])

  // ── 앱 시작 시 마지막 폴더 복원 ─────────────────────────
  useEffect(() => {
    if (!isElectron() || !settingsLoaded) return
    const lastPath = settings.lastFolderPath
    if (!lastPath) return
    openFolderByPath(lastPath).then(result => {
      if (result) { setFolderName(result.name); setFolderTree(result.entries) }
      else updateSetting('lastFolderPath', null)
    })
  }, [settingsLoaded])

  // ── Electron 메뉴 상태 동기화 ─────────────────────────────
  useEffect(() => {
    if (!isElectron()) return
    if (!(window as any).electronAPI?.updateMenuState) return
    ;(window as any).electronAPI.updateMenuState({
      userName: user?.displayName ?? user?.email ?? null,
      sidebarOpen, darkMode, columnMode, autoComplete, wordWrap,
    })
  }, [user, sidebarOpen, darkMode, columnMode, autoComplete, wordWrap])

  // ── 탭 이름 편집 ──────────────────────────────────────────
  const handleTabDoubleClick = useCallback((tabId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTabId(tabId)
    setEditingName(name)
  }, [])

  const handleTabRenameCommit = useCallback(() => {
    if (editingTabId) { renameTab(editingTabId, editingName || 'untitled.txt'); saveSessionNow() }
    setEditingTabId(null); setEditingName('')
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

  // ── 폰트 크기 조절 ────────────────────────────────────────
  const changeFontSize = useCallback((delta: number | 'reset') => {
    const next = delta === 'reset' ? 14 : Math.min(32, Math.max(10, fontSize + delta))
    editorRef.current?.updateOptions({ fontSize: next })
    updateSetting('fontSize', next)
    setOpenMenu(null)
  }, [fontSize, updateSetting])

  // ── 파일 열기 ──────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    setOpenMenu(null)
    try {
      const result = await openFile()
      if (!result) return
      openFileAsTab(result.name, result.path, result.content, getLanguage(result.name))
      pushRecent(result.name, result.path)
      setRecentFiles(loadRecent())
    } catch { toast.error('파일을 열 수 없습니다.') }
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
      if (isElectron() && result.path) updateSetting('lastFolderPath', result.path)
    } catch { toast.error('폴더를 열 수 없습니다.') }
  }, [updateSetting])

  // ── 저장/내보내기 ─────────────────────────────────────────
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
    } catch { toast.error('파일 내보내기에 실패했습니다.') }
  }, [activeTab, activeId, markSaved])

  const handleDownload = useCallback(() => {
    setOpenMenu(null)
    if (!activeTab) return
    const blob = new Blob([activeTab.content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = activeTab.name; a.click()
    URL.revokeObjectURL(url)
  }, [activeTab])

  // ── 탭 닫기 ───────────────────────────────────────────────
  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    // 내용이 없는 빈 탭은 바로 닫기
    if (!tab.content) {
      closeTab(tabId, (id) => removeTabDoc(id))
      return
    }
    // 내용이 있으면 삭제 안내
    const msg = isElectron()
      ? `"${tab.name}" 탭을 닫으면 Firebase에서 데이터가 삭제됩니다.\n필요하면 로컬 파일로 내보내기 후 닫으세요.\n\n닫으시겠습니까?`
      : `"${tab.name}" 탭을 닫으면 Firebase에서 데이터가 삭제됩니다.\n필요하면 파일로 내려받기 후 닫으세요.\n\n닫으시겠습니까?`
    if (!window.confirm(msg)) return
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
    } catch { toast.error('파일을 읽을 수 없습니다.') }
  }, [openFileAsTab])

  // ── 드래그 앤 드롭 ────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderTabs(String(active.id), String(over.id))
      saveSessionNow()
    }
  }, [reorderTabs, saveSessionNow])

  // ── Electron 메뉴 이벤트 ─────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return
    const offs = [
      onMenuEvent('menu:new-file',            openNewTab),
      onMenuEvent('menu:open-file',           handleOpen),
      onMenuEvent('menu:open-folder',         handleOpenFolder),
      onMenuEvent('menu:save-as',             handleSaveAs),
      onMenuEvent('menu:find',                () => editorRef.current?.trigger('', 'actions.find', null)),
      onMenuEvent('menu:replace',             () => editorRef.current?.trigger('', 'editor.action.startFindReplaceAction', null)),
      onMenuEvent('menu:toggle-sidebar',      () => updateSetting('sidebarOpen', !sidebarOpen)),
      onMenuEvent('menu:toggle-theme',        () => updateSetting('darkMode', !darkMode)),
      onMenuEvent('menu:toggle-column',       toggleColumnMode),
      onMenuEvent('menu:toggle-autocomplete', toggleAutoComplete),
      onMenuEvent('menu:toggle-wordwrap', () => updateSetting('wordWrap', !wordWrap)),
      onMenuEvent('menu:font-increase',  () => changeFontSize(+2)),
      onMenuEvent('menu:font-decrease',  () => changeFontSize(-2)),
      onMenuEvent('menu:font-reset',     () => changeFontSize('reset')),
      onMenuEvent('menu:sign-out',       signOut),
    ]
    return () => offs.forEach(off => off())
  }, [openNewTab, handleOpen, handleOpenFolder, handleSaveAs, sidebarOpen, darkMode,
      toggleColumnMode, toggleAutoComplete, updateSetting, changeFontSize, signOut])

  // ── Monaco 마운트 ──────────────────────────────────────────
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => changeFontSize(+2))
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => changeFontSize(-2))
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () => changeFontSize('reset'))
    if (isElectron()) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, handleSaveAs)
    }

    const updateCursor = () => {
      const pos = editor.getPosition(); const model = editor.getModel(); const sel = editor.getSelection()
      const selected = sel && model ? model.getValueInRange(sel).length : 0
      setCursorInfo({ line: pos?.lineNumber ?? 1, col: pos?.column ?? 1, selected, total: model?.getValue().length ?? 0 })
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
        { label: '새 파일',     shortcut: '',       action: () => { openNewTab(); setOpenMenu(null) } },
        { label: '파일 열기...', shortcut: 'Ctrl+O', action: handleOpen },
        { label: '폴더 열기...', shortcut: '',       action: handleOpenFolder },
        { type: 'sep' },
        ...(isElectron()
          ? [{ label: '로컬 파일로 내보내기...', shortcut: 'Ctrl+Shift+S', action: handleSaveAs }]
          : [{ label: '파일로 내려받기',         shortcut: '',             action: handleDownload }]
        ),
        ...(recentFiles.length > 0 ? [
          { type: 'sep' },
          { label: '최근 파일', shortcut: '', action: () => {}, disabled: true },
          ...recentFiles.slice(0, 5).map(r => ({ label: r.name, shortcut: '', action: () => handleOpenRecent(r), isRecent: true })),
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
        { label: `줄 바꿈 ${wordWrap ? '끄기 ✓' : '켜기'}`, shortcut: 'Alt+Z', action: () => { updateSetting('wordWrap', !wordWrap); setOpenMenu(null) } },
        { type: 'sep' },
        { label: `폰트 크기 확대 (${fontSize}px)`, shortcut: 'Ctrl+=', action: () => changeFontSize(+2) },
        { label: '폰트 크기 축소',                  shortcut: 'Ctrl+-', action: () => changeFontSize(-2) },
        { label: '폰트 크기 기본값 (14px)',          shortcut: 'Ctrl+0', action: () => changeFontSize('reset') },
      ],
    },
    {
      id: 'account', label: '계정',
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
          <span className="tree-icon">{entry.kind === 'directory' ? (expandedDirs.has(entry.path) ? '▾' : '▸') : fileIcon(entry.name)}</span>
          <span className="tree-name">{entry.name}</span>
        </div>
        {entry.kind === 'directory' && expandedDirs.has(entry.path) && entry.children && renderTree(entry.children, depth + 1)}
      </div>
    ))

  if (loading)                           return <div className="app-loading">로딩 중...</div>
  if (!user)                             return <Login onSignIn={signIn} />
  if (!sessionLoaded || !settingsLoaded) return <div className="app-loading">이전 작업 불러오는 중...</div>

  return (
    <div className={`app ${darkMode ? 'app--dark' : ''}`}>

      {/* 메뉴바 */}
      {!isElectron() && (
        <header className="menubar">
          <img src="/icons/icon-192.png" alt="Pumice" className="menubar-brand-icon" />
          <nav className="menubar-nav" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            {menus.map(menu => (
              <div key={menu.id} className="dropdown">
                <button
                  className={`dropdown__trigger ${openMenu === menu.id ? 'dropdown__trigger--open' : ''}`}
                  onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                >
                  {menu.id === 'account' && user?.photoURL && <img src={user.photoURL} alt="" className="menubar-avatar" />}
                  {menu.label}
                </button>
                {openMenu === menu.id && (
                  <div className="dropdown__panel">
                    {menu.items.map((item: any, i) =>
                      item.type === 'sep'
                        ? <div key={i} className="dropdown__sep" />
                        : (
                          <button key={i}
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

      {/* 탭바 — 드래그 앤 드롭 */}
      <div className="tabbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            <div className="tabs-track">
              {tabs.map(tab => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeId}
                  isEditing={editingTabId === tab.id}
                  editingName={editingName}
                  inputRef={tabInputRef}
                  onActivate={() => setActiveId(tab.id)}
                  onDoubleClick={e => handleTabDoubleClick(tab.id, tab.name, e)}
                  onClose={e => handleCloseTab(tab.id, e)}
                  onEditChange={setEditingName}
                  onEditCommit={handleTabRenameCommit}
                  onEditKeyDown={handleTabRenameKeyDown}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button className="tabbar__add" onClick={openNewTab} title="새 탭 (Ctrl+N)">+</button>
      </div>

      {/* 워크스페이스 */}
      <div className="workspace">
        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar__header">
              <span className="sidebar__title">{folderName ?? '탐색기'}</span>
              <button className="sidebar__btn" onClick={handleOpenFolder}>{folderName ? '↺' : '열기'}</button>
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
              fontSize, lineHeight: Math.round(fontSize * 1.6), letterSpacing: 0.3, fontLigatures: true,
              lineNumbers: 'on', lineNumbersMinChars: 4, lineDecorationsWidth: 8, glyphMargin: false,
              columnSelection: columnMode, multiCursorModifier: 'ctrlCmd',
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
              wordWrap: wordWrap ? 'on' : 'off', accessibilitySupport: 'off',
            }}
            onMount={handleEditorMount}
            onChange={value => handleContentChange(value ?? '')}
          />
        </div>
      </div>

      {/* 상태바 */}
      <footer className="statusbar">
        <div className="statusbar__left">
          <span className="status-pill">{activeTab?.language ?? 'plaintext'}</span>
          <span className="status-sep">│</span>
          <span className={`status-pill ${syncStatus === 'offline' || syncStatus === 'error' ? 'status-pill--dirty' : syncStatus === 'saving' ? 'status-pill--col' : ''}`}>
            {syncStatus === 'offline' ? '● 오프라인' : syncStatus === 'error' ? '● 오류' : syncStatus === 'saving' ? '↑ 동기화 중...' : '✓ 동기화됨'}
          </span>
        </div>
        <div className="statusbar__right">
          {/* 찾기/바꾸기 안내 */}
          <span className="status-pill status-hint">Ctrl+F 찾기 · Ctrl+H 바꾸기</span>
          <span className="status-sep">│</span>
          {cursorInfo.selected > 0 && <><span className="status-pill">선택 {cursorInfo.selected}자</span><span className="status-sep">│</span></>}
          <span className="status-pill">{cursorInfo.total.toLocaleString()}자</span>
          <span className="status-sep">│</span>
          <span className="status-pill">{cursorInfo.line}줄 {cursorInfo.col}열</span>
          <span className="status-sep">│</span>
          {columnMode    && <><span className="status-pill status-pill--col">열 블록</span><span className="status-sep">│</span></>}
          {!autoComplete && <><span className="status-pill status-pill--off">자동완성 OFF</span><span className="status-sep">│</span></>}
          {/* 인코딩 선택 */}
          <div className="enc-menu" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <button className="status-pill status-enc" onClick={() => setShowEncMenu(p => !p)}>
              {encoding} ▾
            </button>
            {showEncMenu && (
              <div className="enc-menu__panel">
                {ENCODINGS.map(enc => (
                  <button key={enc}
                    className={`enc-menu__item ${enc === encoding ? 'enc-menu__item--active' : ''}`}
                    onClick={() => { updateSetting('encoding', enc); setShowEncMenu(false) }}
                  >
                    {enc}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = { js: 'JS', jsx: 'JS', ts: 'TS', tsx: 'TS', html: 'HT', htm: 'HT', css: 'CS', java: 'JV', txt: '—' }
  return map[ext ?? ''] ?? '·'
}
