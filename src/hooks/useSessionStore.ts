/**
 * useSessionStore.ts
 * - 세션 복원 시 Firebase 실패하면 localStorage 백업에서 복원
 * - 탭 이름 변경 시 즉시 저장 지원
 * - 세션 저장 시 localStorage에도 백업
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  ref, set, get, remove, serverTimestamp,
} from 'firebase/database'
import { db } from '../firebase'
import type { User } from 'firebase/auth'
import type { Tab } from './useEditorStore'

const BACKUP_KEY = 'koditor:sessionBackup'

interface SessionTab {
  id: string
  name: string
  language: string
}

interface UseSessionStoreOptions {
  user: User
  tabs: Tab[]
  activeId: string
  onSessionLoaded: (tabs: Tab[], activeId: string) => void
}

// localStorage 백업 저장
function saveBackup(tabs: Tab[], activeId: string) {
  try {
    const data = {
      tabs: tabs.map(t => ({ id: t.id, name: t.name, language: t.language, content: t.content })),
      activeId,
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data))
  } catch {}
}

// localStorage 백업 로드
function loadBackup(): { tabs: Tab[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.tabs?.length) return null
    return {
      tabs: data.tabs.map((t: any) => ({
        id: t.id, name: t.name, path: '', content: t.content ?? '',
        savedContent: t.content ?? '', language: t.language ?? 'plaintext', isDirty: false,
      })),
      activeId: data.activeId,
    }
  } catch { return null }
}

export function useSessionStore({
  user, tabs, activeId, onSessionLoaded,
}: UseSessionStoreOptions) {
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoading    = useRef(false)
  const forceNow     = useRef(false)

  // ── 앱 시작 시 세션 복원 ──────────────────────────────────
  useEffect(() => {
    if (!user || sessionLoaded) return

    const load = async () => {
      isLoading.current = true
      try {
        const snap = await get(ref(db, `users/${user.uid}/session`))
        const data = snap.val()

        if (!data?.tabs?.length) {
          // Firebase에 세션 없음 → 백업 시도
          const backup = loadBackup()
          if (backup) {
            onSessionLoaded(backup.tabs, backup.activeId)
          }
          setSessionLoaded(true)
          return
        }

        // 각 탭 내용 병렬로 불러오기
        const restoredTabs: Tab[] = await Promise.all(
          (data.tabs as SessionTab[]).map(async (t) => {
            try {
              const docSnap = await get(ref(db, `users/${user.uid}/docs/${t.id}`))
              const content = docSnap.val()?.content ?? ''
              return {
                id: t.id, name: t.name, path: '', content,
                savedContent: content, language: t.language ?? 'plaintext', isDirty: false,
              }
            } catch {
              return {
                id: t.id, name: t.name, path: '', content: '',
                savedContent: '', language: t.language ?? 'plaintext', isDirty: false,
              }
            }
          })
        )

        const restoredActiveId = restoredTabs.find(t => t.id === data.activeId)
          ? data.activeId
          : restoredTabs[0].id

        onSessionLoaded(restoredTabs, restoredActiveId)
        saveBackup(restoredTabs, restoredActiveId)

      } catch (err) {
        console.warn('Firebase 세션 로드 실패, 백업에서 복원:', err)
        // Firebase 실패 → localStorage 백업으로 복원
        const backup = loadBackup()
        if (backup) {
          onSessionLoaded(backup.tabs, backup.activeId)
        }
      } finally {
        isLoading.current = false
        setSessionLoaded(true)
      }
    }

    load()
  }, [user, sessionLoaded, onSessionLoaded])

  // ── 세션 저장 (디바운스 500ms, 탭 이름 변경 시 즉시) ──────
  const saveSession = useCallback((immediate = false) => {
    if (!user || !sessionLoaded || isLoading.current) return

    const doSave = async () => {
      try {
        const sessionTabs: SessionTab[] = tabs.map(t => ({
          id: t.id, name: t.name, language: t.language,
        }))
        await set(ref(db, `users/${user.uid}/session`), {
          tabs: sessionTabs, activeId, updatedAt: serverTimestamp(),
        })
        // 로컬 백업도 동시 업데이트
        saveBackup(tabs, activeId)
      } catch (err) {
        console.warn('세션 저장 실패:', err)
        // Firebase 실패해도 로컬 백업은 저장
        saveBackup(tabs, activeId)
      }
    }

    if (immediate || forceNow.current) {
      forceNow.current = false
      if (saveTimer.current) clearTimeout(saveTimer.current)
      doSave()
      return
    }

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(doSave, 500)
  }, [user, sessionLoaded, tabs, activeId])

  useEffect(() => {
    saveSession()
  }, [saveSession])

  // 탭 이름 변경 시 즉시 저장 트리거
  const saveSessionNow = useCallback(() => {
    forceNow.current = true
    saveSession(true)
  }, [saveSession])

  // 탭 닫을 때 Firebase에서 탭 데이터 삭제
  const removeTabDoc = useCallback(async (tabId: string) => {
    if (!user) return
    try {
      await remove(ref(db, `users/${user.uid}/docs/${tabId}`))
    } catch (err) {
      console.warn('탭 데이터 삭제 실패:', err)
    }
  }, [user])

  return { sessionLoaded, removeTabDoc, saveSessionNow }
}
