/**
 * useEditorStore.ts
 * 에디터 전체 상태 관리
 */

import { useState, useCallback } from 'react'

export interface Tab {
  id: string
  name: string
  path: string
  content: string
  savedContent: string
  language: string
  isDirty: boolean
}

const uid = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function makeBlankTab(): Tab {
  return {
    id: uid(),
    name: 'untitled.txt',
    path: '',
    content: '',
    savedContent: '',
    language: 'plaintext',
    isDirty: false,
  }
}

export function useEditorStore() {
  const [tabs, setTabs]         = useState<Tab[]>([makeBlankTab()])
  const [activeId, setActiveId] = useState<string>(tabs[0].id)

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  // ── Firebase 세션 복원 시 탭 전체 교체 ───────────────────
  const restoreTabs = useCallback((restoredTabs: Tab[], restoredActiveId: string) => {
    setTabs(restoredTabs)
    setActiveId(restoredActiveId)
  }, [])

  // ── 새 탭 ────────────────────────────────────────────────
  const openNewTab = useCallback(() => {
    const tab = makeBlankTab()
    setTabs(prev => [...prev, tab])
    setActiveId(tab.id)
  }, [])

  // ── 파일을 탭으로 열기 ────────────────────────────────────
  const openFileAsTab = useCallback((
    name: string,
    path: string,
    content: string,
    language: string,
  ) => {
    setTabs(prev => {
      if (path) {
        const existing = prev.find(t => t.path === path)
        if (existing) {
          setActiveId(existing.id)
          return prev
        }
      }
      const tab: Tab = {
        id: uid(), name, path, content,
        savedContent: content, language, isDirty: false,
      }
      setActiveId(tab.id)
      return [...prev, tab]
    })
  }, [])

  // ── 에디터 내용 변경 ──────────────────────────────────────
  const updateContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? { ...t, content, isDirty: content !== t.savedContent }
        : t
    ))
  }, [])

  // ── 탭 이름 변경 ──────────────────────────────────────────
  const renameTab = useCallback((tabId: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, name: trimmed } : t
    ))
  }, [])

  // ── 저장 완료 처리 ────────────────────────────────────────
  const markSaved = useCallback((tabId: string, newPath?: string, newName?: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? { ...t, savedContent: t.content, isDirty: false, path: newPath ?? t.path, name: newName ?? t.name }
        : t
    ))
  }, [])

  // ── 탭 닫기 ───────────────────────────────────────────────
  const closeTab = useCallback((tabId: string, onRemoved?: (id: string) => void) => {
    setTabs(prev => {
      if (prev.length === 1) {
        const blank = makeBlankTab()
        setActiveId(blank.id)
        onRemoved?.(tabId)
        return [blank]
      }
      const idx = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      if (activeId === tabId) {
        setActiveId(next[Math.min(idx, next.length - 1)].id)
      }
      onRemoved?.(tabId)
      return next
    })
  }, [activeId])

  return {
    tabs, activeId, activeTab,
    setActiveId, restoreTabs,
    openNewTab, openFileAsTab,
    updateContent, renameTab, markSaved, closeTab,
  }
}
