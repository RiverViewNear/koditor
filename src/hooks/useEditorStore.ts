/**
 * useEditorStore.ts
 *
 * 에디터 전체 상태 관리
 *   - 열린 탭 목록
 *   - 활성 탭
 *   - 탭별 내용 / 저장 여부 / 언어
 */

import { useState, useCallback } from 'react'

export interface Tab {
  id: string
  name: string
  path: string           // 실제 파일 경로 (웹에선 파일명만)
  content: string        // 현재 에디터 내용
  savedContent: string   // 마지막 저장 시점의 내용
  language: string       // Monaco 언어 ID
  isDirty: boolean       // 미저장 변경사항 여부
}

let _id = 0
const uid = () => `tab-${++_id}`

function makeBlankTab(): Tab {
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
  const [tabs, setTabs] = useState<Tab[]>([makeBlankTab()])
  const [activeId, setActiveId] = useState<string>(tabs[0].id)

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  // ── 새 탭 ────────────────────────────────────────────
  const openNewTab = useCallback(() => {
    const tab = makeBlankTab()
    setTabs(prev => [...prev, tab])
    setActiveId(tab.id)
  }, [])

  // ── 파일을 탭으로 열기 ────────────────────────────────
  // 이미 열린 파일이면 해당 탭으로 포커스만 이동
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

  // ── 에디터 내용 변경 ──────────────────────────────────
  const updateContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? { ...t, content, isDirty: content !== t.savedContent }
        : t
    ))
  }, [])

  // ── 저장 완료 처리 ────────────────────────────────────
  const markSaved = useCallback((
    tabId: string,
    newPath?: string,
    newName?: string,
  ) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? {
            ...t,
            savedContent: t.content,
            isDirty: false,
            path: newPath ?? t.path,
            name: newName ?? t.name,
          }
        : t
    ))
  }, [])

  // ── 탭 닫기 ───────────────────────────────────────────
  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length === 1) {
        // 마지막 탭: 닫지 않고 빈 탭으로 초기화
        const blank = makeBlankTab()
        setActiveId(blank.id)
        return [blank]
      }
      const idx = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      if (activeId === tabId) {
        setActiveId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }, [activeId])

  return {
    tabs,
    activeId,
    activeTab,
    setActiveId,
    openNewTab,
    openFileAsTab,
    updateContent,
    markSaved,
    closeTab,
  }
}
