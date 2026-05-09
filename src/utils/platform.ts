/**
 * platform.ts
 *
 * 플랫폼 추상화 레이어
 *   - Electron (데스크탑): window.electronAPI → IPC → Node.js fs
 *   - Web (브라우저):      File System Access API + Blob 다운로드
 *
 * 이 파일만 보면 플랫폼별 동작 전체를 파악할 수 있습니다.
 */

// Electron 환경 감지
export const isElectron = (): boolean =>
  typeof window !== 'undefined' && 'electronAPI' in window

// Electron API 타입 선언 (preload.js와 1:1 대응)
declare global {
  interface Window {
    electronAPI?: {
      openFile: () => Promise<{ name: string; path: string; content: string } | null>
      openFolder: () => Promise<{ name: string; path: string; entries: FolderEntry[] } | null>
      saveFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
      saveAs: (defaultName: string) => Promise<string | null>
      readFile: (path: string) => Promise<string>
      onMenuEvent: (channel: string, cb: () => void) => void
      offMenuEvent: (channel: string, cb: () => void) => void
      openAuthBrowser: (authUrl: string) => Promise<boolean>
      startAuthServer: (port: number) => Promise<{ code: string; state: string }>
      openFolderByPath: (folderPath: string) => Promise<{ name: string; path: string; entries: FolderEntry[] } | null>
      platform: 'darwin' | 'win32' | 'linux'
    }
  }
}

// ── 타입 ─────────────────────────────────────────────────

export interface OpenedFile {
  name: string
  path: string
  content: string
}

export interface SaveResult {
  success: boolean
  path?: string
  error?: string
}

export interface FolderEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
  children?: FolderEntry[]
  read?: () => Promise<string>   // 파일인 경우에만 존재
}

export interface OpenedFolder {
  name: string
  path: string   // 폴더 전체 경로 (재시작 시 복원용)
  entries: FolderEntry[]
}

// ── 파일 열기 ────────────────────────────────────────────

export async function openFile(): Promise<OpenedFile | null> {
  if (isElectron()) {
    // Electron: 네이티브 파일 다이얼로그
    return window.electronAPI!.openFile()
  }

  // Web: File System Access API (Chrome/Edge 86+)
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: '코드 파일',
        accept: {
          'text/plain': ['.txt', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.java'],
        },
      }],
      multiple: false,
    })
    const file = await handle.getFile()
    const content = await file.text()
    return { name: file.name, path: file.name, content }
  } catch {
    // 사용자가 취소하거나 API 미지원
    return null
  }
}

// ── 경로로 폴더 다시 열기 (Electron 전용, 앱 재시작 시 복원용) ──
export async function openFolderByPath(folderPath: string): Promise<OpenedFolder | null> {
  if (!isElectron()) return null
  try {
    const result = await window.electronAPI!.openFolderByPath(folderPath)
    if (!result) return null
    const injectRead = (entries: FolderEntry[]): FolderEntry[] =>
      entries.map(e => ({
        ...e,
        read: e.kind === 'file'
          ? () => window.electronAPI!.readFile(e.path)
          : undefined,
        children: e.children ? injectRead(e.children) : undefined,
      }))
    return { name: result.name, path: result.path ?? '', entries: injectRead(result.entries) }
  } catch {
    return null
  }
}

// ── 폴더 열기 ────────────────────────────────────────────

export async function openFolder(): Promise<OpenedFolder | null> {
  if (isElectron()) {
    const result = await window.electronAPI!.openFolder()
    if (!result) return null
    // Electron에서 온 entries는 read 함수가 없으므로 주입
    const injectRead = (entries: FolderEntry[]): FolderEntry[] =>
      entries.map(e => ({
        ...e,
        read: e.kind === 'file'
          ? () => window.electronAPI!.readFile(e.path)
          : undefined,
        children: e.children ? injectRead(e.children) : undefined,
      }))
    return { name: result.name, path: result.path ?? '', entries: injectRead(result.entries) }
  }

  // Web: showDirectoryPicker (Chrome/Edge 86+)
  try {
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
    const entries = await readDirHandle(dirHandle, dirHandle.name)
    return { name: dirHandle.name, path: dirHandle.name, entries }
  } catch {
    return null
  }
}

// 웹용: FileSystemDirectoryHandle 재귀 읽기
async function readDirHandle(handle: any, basePath: string): Promise<FolderEntry[]> {
  const entries: FolderEntry[] = []
  for await (const [name, child] of handle.entries()) {
    const path = `${basePath}/${name}`
    if (child.kind === 'directory') {
      const children = await readDirHandle(child, path)
      entries.push({ name, path, kind: 'directory', children })
    } else {
      const fileHandle = child
      entries.push({
        name, path, kind: 'file',
        read: async () => {
          const file = await fileHandle.getFile()
          return file.text()
        },
      })
    }
  }
  // 폴더 먼저, 그 다음 파일 / 이름순 정렬
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}



export async function saveFile(path: string, content: string): Promise<SaveResult> {
  if (isElectron()) {
    return window.electronAPI!.saveFile(path, content)
  }

  // Web: Blob 다운로드 fallback
  downloadBlob(content, path.split(/[\\/]/).pop() ?? 'file.txt')
  return { success: true }
}

// ── 다른 이름으로 저장 ───────────────────────────────────

export async function saveFileAs(
  content: string,
  defaultName = 'untitled.txt',
): Promise<SaveResult> {
  if (isElectron()) {
    const savePath = await window.electronAPI!.saveAs(defaultName)
    if (!savePath) return { success: false }

    const result = await window.electronAPI!.saveFile(savePath, content)
    return { ...result, path: savePath }
  }

  // Web: Blob 다운로드
  downloadBlob(content, defaultName)
  return { success: true, path: defaultName }
}

// ── 메뉴 이벤트 수신 (Electron 전용) ────────────────────

export function onMenuEvent(channel: string, cb: () => void): () => void {
  if (!isElectron()) return () => {}
  window.electronAPI!.onMenuEvent(channel, cb)
  return () => window.electronAPI!.offMenuEvent(channel, cb)
}

// ── 유틸 ────────────────────────────────────────────────

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 파일 확장자 → Monaco 언어 ID
export function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html',
    css: 'css',
    java: 'java',
    txt: 'plaintext',
  }
  return map[ext] ?? 'plaintext'
}
