import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useEditorStore } from './hooks/useEditorStore'
import {
  openFile, saveFile, saveFileAs,
  getLanguage, onMenuEvent, isElectron,
  openFolder, type FolderEntry,
} from './utils/platform'
import './styles/app.css'

// ── 최근 파일 목록 (localStorage) ─────────────────────────
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

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function App() {
  const {
    tabs, activeId, activeTab,
    setActiveId, openNewTab, openFileAsTab,
    updateContent, markSaved, closeTab,
  } = useEditorStore()

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  // ── UI 상태 ───────────────────────────────────────────────
  const [columnMode,    setColumnMode]    = useState(false)
  const [autoComplete,  setAutoComplete]  = useState(true)
  const [darkMode,      setDarkMode]      = useState(false)
  const [openMenu,      setOpenMenu]      = useState<string | null>(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(true)
  const [folderName,    setFolderName]    = useState<string | null>(null)
  const [folderTree,    setFolderTree]    = useState<FolderEntry[]>([])
  const [expandedDirs,  setExpandedDirs]  = useState<Set<string>>(new Set())
  const [recentFiles,   setRecentFiles]   = useState<RecentFile[]>(loadRecent)

  // ── 커서/글자 수 상태 ─────────────────────────────────────
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, selected: 0, total: 0 })

  // 메뉴 외부 클릭 닫기
  useEffect(() => {
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // 다크모드 body 클래스
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
  }, [darkMode])

  // ── 토글 핸들러 ───────────────────────────────────────────
  const toggleColumnMode = useCallback(() => {
    setColumnMode(prev => {
      const next = !prev
      editorRef.current?.updateOptions({ columnSelection: next })
      editorRef.current?.focus()
      return next
    })
  }, [])

  const toggleAutoComplete = useCallback(() => {
    setAutoComplete(prev => {
      const next = !prev
      editorRef.current?.updateOptions({
        quickSuggestions: next ? { other: true, comments: false, strings: false } : false,
        suggestOnTriggerCharacters: next,
        parameterHints: { enabled: next },
        wordBasedSuggestions: next ? 'currentDocument' : 'off',
      })
      editorRef.current?.focus()
      return next
    })
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev)
  }, [])

  // ── 파일 열기 ──────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    setOpenMenu(null)
    const result = await openFile()
    if (!result) return
    openFileAsTab(result.name, result.path, result.content, getLanguage(result.name))
    pushRecent(result.name, result.path)
    setRecentFiles(loadRecent())
  }, [openFileAsTab])

  const handleOpenRecent = useCallback(async (recent: RecentFile) => {
    setOpenMenu(null)
    if (isElectron()) {
      const result = await window.electronAPI!.openFile()
      if (!result) return
      openFileAsTab(result.name, result.path, result.content, getLanguage(result.name))
    } else {
      // 웹: 최근 파일은 경로만 있고 다시 읽을 수 없으므로 열기 다이얼로그 유도
      alert(`웹 환경에서는 파일을 다시 선택해야 합니다.\n파일명: ${recent.name}`)
    }
  }, [openFileAsTab])

  // ── 폴더 열기 ──────────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    setOpenMenu(null)
    const result = await openFolder()
    if (!result) return
    setFolderName(result.name)
    setFolderTree(result.entries)
    setSidebarOpen(true)
  }, [])

  // ── 저장 ───────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setOpenMenu(null)
    if (!activeTab) return
    if (!activeTab.path) {
      const result = await saveFileAs(activeTab.content, activeTab.name)
      if (result.success && result.path) {
        const newName = result.path.split(/[\\/]/).pop() ?? activeTab.name
        markSaved(activeId, result.path, newName)
        pushRecent(newName, result.path)
        setRecentFiles(loadRecent())
      }
      return
    }
    const result = await saveFile(activeTab.path, activeTab.content)
    if (result.success) {
      markSaved(activeId)
      pushRecent(activeTab.name, activeTab.path)
      setRecentFiles(loadRecent())
    }
  }, [activeTab, activeId, markSaved])

  const handleSaveAs = useCallback(async () => {
    setOpenMenu(null)
    if (!activeTab) return
    const result = await saveFileAs(activeTab.content, activeTab.name)
    if (result.success && result.path) {
      const newName = result.path.split(/[\\/]/).pop() ?? activeTab.name
      markSaved(activeId, result.path, newName)
      pushRecent(newName, result.path)
      setRecentFiles(loadRecent())
    }
  }, [activeTab, activeId, markSaved])

  // ── 탭 닫기 ───────────────────────────────────────────────
  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      if (!window.confirm(`"${tab.name}"에 저장하지 않은 변경사항이 있습니다.\n닫으시겠습니까?`)) return
    }
    closeTab(tabId)
  }, [tabs, closeTab])

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
    } catch { alert('파일을 읽을 수 없습니다.') }
  }, [openFileAsTab])

  // ── Electron 네이티브 메뉴 ────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return
    const offs = [
      onMenuEvent('menu:new-file',    openNewTab),
      onMenuEvent('menu:open-file',   handleOpen),
      onMenuEvent('menu:open-folder', handleOpenFolder),
      onMenuEvent('menu:save',        handleSave),
      onMenuEvent('menu:save-as',     handleSaveAs),
    ]
    return () => offs.forEach(off => off())
  }, [openNewTab, handleOpen, handleOpenFolder, handleSave, handleSaveAs])

  // ── Monaco 마운트 ──────────────────────────────────────────
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // 단축키
    if (!isElectron()) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, handleSaveAs)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, openNewTab)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, handleOpen)
    }

    // 커서 위치 & 글자 수 업데이트
    const updateCursor = () => {
      const pos      = editor.getPosition()
      const model    = editor.getModel()
      const sel      = editor.getSelection()
      const selected = sel && model ? model.getValueInRange(sel).length : 0
      const total    = model?.getValue().length ?? 0
      setCursorInfo({
        line:     pos?.lineNumber ?? 1,
        col:      pos?.column ?? 1,
        selected,
        total,
      })
    }

    editor.onDidChangeCursorPosition(updateCursor)
    editor.onDidChangeModelContent(updateCursor)
    editor.onDidChangeCursorSelection(updateCursor)
    updateCursor()

    editor.focus()
  }

  // ── 드롭다운 메뉴 정의 ────────────────────────────────────
  const menus = [
    {
      id: 'file', label: '파일',
      items: [
        { label: '새 파일',              shortcut: 'Ctrl+N',       action: () => { openNewTab(); setOpenMenu(null) } },
        { label: '파일 열기...',          shortcut: 'Ctrl+O',       action: handleOpen },
        { label: '폴더 열기...',          shortcut: '',             action: handleOpenFolder },
        { type: 'sep' },
        { label: '저장',                  shortcut: 'Ctrl+S',       action: handleSave },
        { label: '다른 이름으로 저장...', shortcut: 'Ctrl+Shift+S', action: handleSaveAs },
        ...(recentFiles.length > 0 ? [
          { type: 'sep' },
          { label: '최근 파일', shortcut: '', action: () => {}, disabled: true },
          ...recentFiles.slice(0, 5).map(r => ({
            label: r.name,
            shortcut: '',
            action: () => handleOpenRecent(r),
            isRecent: true,
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
        { label: `파일 탐색기 ${sidebarOpen ? '숨기기 ✓' : '보이기'}`, shortcut: '', action: () => { setSidebarOpen(p => !p); setOpenMenu(null) } },
        { type: 'sep' },
        { label: `테마: ${darkMode ? '🌙 다크' : '☀️ 라이트'}`, shortcut: '', action: () => { toggleDarkMode(); setOpenMenu(null) } },
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

  // ── 렌더 ──────────────────────────────────────────────────
  return (
    <div className={`app ${darkMode ? 'app--dark' : ''}`}>

      {/* 메뉴바 */}
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

          {/* 메뉴바 우측 토글 배지 */}
          <div className="menubar-badges">
            {columnMode   && <span className="badge badge--blue">열 블록</span>}
            {!autoComplete && <span className="badge badge--gray">자동완성 OFF</span>}
            {darkMode      && <span className="badge badge--dark">🌙</span>}
          </div>
        </header>
      )}

      {/* 탭바 */}
      <div className="tabbar">
        <div className="tabs-track">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeId ? 'tab--active' : ''}`}
              onClick={() => setActiveId(tab.id)}
              title={tab.path || tab.name}
            >
              <span className={`tab__dot tab__dot--${tab.language}`} />
              <span className="tab__name">{tab.name}</span>
              {tab.isDirty && <span className="tab__unsaved" />}
              <button className="tab__close" onClick={e => handleCloseTab(tab.id, e)}>×</button>
            </div>
          ))}
        </div>
        <button className="tabbar__add" onClick={openNewTab} title="새 탭 (Ctrl+N)">+</button>
      </div>

      {/* 워크스페이스 */}
      <div className="workspace">
        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar__header">
              <span className="sidebar__title">{folderName ?? '탐색기'}</span>
              <button className="sidebar__btn" onClick={handleOpenFolder} title="폴더 열기">
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
              // 자동완성 토글
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
            onChange={value => updateContent(activeId, value ?? '')}
          />
        </div>
      </div>

      {/* 상태바 */}
      <footer className="statusbar">
        <div className="statusbar__left">
          <span className="status-pill">{activeTab?.language ?? 'plaintext'}</span>
          <span className="status-sep">│</span>
          <span className={`status-pill ${activeTab?.isDirty ? 'status-pill--dirty' : ''}`}>
            {activeTab?.isDirty ? '● 수정됨' : '저장됨'}
          </span>
          {activeTab?.path && <>
            <span className="status-sep">│</span>
            <span className="status-path">{activeTab.path}</span>
          </>}
        </div>
        <div className="statusbar__right">
          {/* 선택 글자 수 */}
          {cursorInfo.selected > 0 && <>
            <span className="status-pill">선택 {cursorInfo.selected}자</span>
            <span className="status-sep">│</span>
          </>}
          {/* 전체 글자 수 */}
          <span className="status-pill">{cursorInfo.total.toLocaleString()}자</span>
          <span className="status-sep">│</span>
          {/* 커서 위치 */}
          <span className="status-pill">
            {cursorInfo.line}줄 {cursorInfo.col}열
          </span>
          <span className="status-sep">│</span>
          {columnMode && <><span className="status-pill status-pill--col">열 블록</span><span className="status-sep">│</span></>}
          {!autoComplete && <><span className="status-pill status-pill--off">자동완성 OFF</span><span className="status-sep">│</span></>}
          <span className="status-pill">UTF-8</span>
          <span className="status-sep">│</span>
          <span className="status-pill">LF</span>
        </div>
      </footer>
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
