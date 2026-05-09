/**
 * useSessionStore.ts
 *
 * Firebase에 탭 세션 전체를 저장/복원
 * 경로: users/{uid}/session/
 *   - tabs: 탭 목록 (id, name, language)
 *   - activeId: 현재 활성 탭 ID
 *   - docs/{tabId}: 각 탭의 내용
 *
 * 동작:
 *   - 로그인 후 Firebase에서 마지막 세션 복원
 *   - 탭 추가/삭제/전환 시 Firebase에 자동 저장
 *   - 새로고침/다른 기기에서 열어도 그대로 복원
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  ref,
  set,
  get,
  remove,
  serverTimestamp,
} from 'firebase/database'
import { db } from '../firebase'
import type { User } from 'firebase/auth'
import type { Tab } from './useEditorStore'

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

export function useSessionStore({
  user,
  tabs,
  activeId,
  onSessionLoaded,
}: UseSessionStoreOptions) {
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoading = useRef(false)

  // ── 앱 시작 시 세션 복원 ──────────────────────────────────
  useEffect(() => {
    if (!user || sessionLoaded) return

    const load = async () => {
      isLoading.current = true
      try {
        const sessionRef = ref(db, `users/${user.uid}/session`)
        const snap = await get(sessionRef)
        const data = snap.val()

        if (!data || !data.tabs || data.tabs.length === 0) {
          // Firebase에 세션 없음 → 기본 빈 탭으로 시작
          setSessionLoaded(true)
          return
        }

        // 각 탭의 내용 불러오기
        const restoredTabs: Tab[] = await Promise.all(
          (data.tabs as SessionTab[]).map(async (t) => {
            const docRef = ref(db, `users/${user.uid}/docs/${t.id}`)
            const docSnap = await get(docRef)
            const docData = docSnap.val()
            const content = docData?.content ?? ''
            return {
              id: t.id,
              name: t.name,
              path: '',
              content,
              savedContent: content,
              language: t.language ?? 'plaintext',
              isDirty: false,
            }
          })
        )

        const restoredActiveId = data.activeId && restoredTabs.find(t => t.id === data.activeId)
          ? data.activeId
          : restoredTabs[0].id

        onSessionLoaded(restoredTabs, restoredActiveId)
      } catch (err) {
        console.warn('세션 복원 실패:', err)
      } finally {
        isLoading.current = false
        setSessionLoaded(true)
      }
    }

    load()
  }, [user, sessionLoaded, onSessionLoaded])

  // ── 탭 목록 + 활성 탭 변경 시 Firebase에 저장 ─────────────
  const saveSession = useCallback(() => {
    if (!user || !sessionLoaded || isLoading.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const sessionTabs: SessionTab[] = tabs.map(t => ({
          id: t.id,
          name: t.name,
          language: t.language,
        }))

        await set(ref(db, `users/${user.uid}/session`), {
          tabs: sessionTabs,
          activeId,
          updatedAt: serverTimestamp(),
        })
      } catch (err) {
        console.warn('세션 저장 실패:', err)
      }
    }, 500)
  }, [user, sessionLoaded, tabs, activeId])

  // tabs 또는 activeId 변경 시 자동 저장
  useEffect(() => {
    saveSession()
  }, [saveSession])

  // ── 탭 닫을 때 해당 탭 데이터 Firebase에서 삭제 ──────────
  const removeTabDoc = useCallback(async (tabId: string) => {
    if (!user) return
    try {
      await remove(ref(db, `users/${user.uid}/docs/${tabId}`))
    } catch (err) {
      console.warn('탭 데이터 삭제 실패:', err)
    }
  }, [user])

  return { sessionLoaded, removeTabDoc }
}
