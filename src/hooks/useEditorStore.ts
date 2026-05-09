/**
 * useEditorStore.ts — 탭/상태 관리
 */

import { useState, useCallback } from 'react'

export interface Tab {
  id:           string
  name:         string
  path:         string
  content:      string
  savedContent: string
  language:     string
  isDirty:      boolean
}

const uid = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function getUntitledName(existingTabs: Tab[]): string {
  const names = new Set(existingTabs.map(t => t.name))
  let n = 1
  while (names.has(`untitled-${n}.txt`)) n++
  return `untitled-${n}.txt`
}

export function makeBlankTab(existingTabs: Tab[] = []): Tab {
  return { id: uid(), name: getUntitledName(existingTabs), path: '', content: '', savedContent: '', language: 'plaintext', isDirty: false }
}

export function useEditorStore() {
  const [tabs,     setTabs]     = useState<Tab[]>([makeBlankTab()])
  const [activeId, setActiveId] = useState<string>(tabs[0].id)

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  const restoreTabs = useCallback((restoredTabs: Tab[], restoredActiveId: string) => {
    setTabs(restoredTabs)
    setActiveId(restoredActiveId)
  }, [])

  const openNewTab = useCallback(() => {
    setTabs(prev => {
      const tab = makeBlankTab(prev)
      setActiveId(tab.id)
      return [...prev, tab]
    })
  }, [])

  const openFileAsTab = useCallback((name: string, path: string, content: string, language: string) => {
    setTabs(prev => {
      if (path) {
        const existing = prev.find(t => t.path === path)
        if (existing) { setActiveId(existing.id); return prev }
      }
      const tab: Tab = { id: uid(), name, path, content, savedContent: content, language, isDirty: false }
      setActiveId(tab.id)
      return [...prev, tab]
    })
  }, [])

  const updateContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, isDirty: content !== t.savedContent } : t
    ))
  }, [])

  const renameTab = useCallback((tabId: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name: trimmed } : t))
  }, [])

  // 탭 드래그 순서 변경
  const reorderTabs = useCallback((fromId: string, toId: string) => {
    setTabs(prev => {
      const fromIdx = prev.findIndex(t => t.id === fromId)
      const toIdx   = prev.findIndex(t => t.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  const markSaved = useCallback((tabId: string, newPath?: string, newName?: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? { ...t, savedContent: t.content, isDirty: false, path: newPath ?? t.path, name: newName ?? t.name }
        : t
    ))
  }, [])

  const closeTab = useCallback((tabId: string, onRemoved?: (id: string) => void) => {
    setTabs(prev => {
      if (prev.length === 1) {
        const blank = makeBlankTab(prev)
        setActiveId(blank.id)
        return [blank]
      }
      const idx  = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      if (activeId === tabId) setActiveId(next[Math.min(idx, next.length - 1)].id)
      return next
    })
    setTimeout(() => onRemoved?.(tabId), 0)
  }, [activeId])

  return {
    tabs, activeId, activeTab,
    setActiveId, restoreTabs,
    openNewTab, openFileAsTab,
    updateContent, renameTab, reorderTabs, markSaved, closeTab,
  }
}
