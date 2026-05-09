/**
 * useSync.ts
 * Firebase Realtime Database 실시간 동기화
 * - activeId 변경 시 이전 리스너 확실히 정리
 * - 디바운스 타이머도 탭 전환 시 초기화
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  ref,
  set,
  onValue,
  serverTimestamp,
  goOnline,
  goOffline,
  type DatabaseReference,
  type Unsubscribe,
} from 'firebase/database'
import { db } from '../firebase'
import type { User } from 'firebase/auth'

interface SyncOptions {
  user: User
  docId: string
  content: string
  onRemoteChange: (content: string) => void
}

export function useSync({ user, docId, content, onRemoteChange }: SyncOptions) {
  const docRef        = useRef<DatabaseReference | null>(null)
  const unsubscribeRef = useRef<Unsubscribe | null>(null)
  const isRemote      = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved     = useRef<string>('')
  const currentDocId  = useRef<string>('')

  useEffect(() => {
    if (!user) return

    // ── 탭 전환 시 이전 리스너 + 타이머 완전 정리 ──────────
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }

    // 탭이 바뀌면 lastSaved 초기화 (이전 탭 내용과 혼동 방지)
    if (currentDocId.current !== docId) {
      lastSaved.current = ''
      currentDocId.current = docId
    }

    docRef.current = ref(db, `users/${user.uid}/docs/${encodeKey(docId)}`)

    // 새 탭 리스너 등록
    unsubscribeRef.current = onValue(docRef.current, (snapshot) => {
      const data = snapshot.val()

      if (!data) {
        // Firebase에 데이터 없으면 현재 내용을 초기값으로 저장
        if (content) {
          set(docRef.current!, {
            content,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
          })
          lastSaved.current = content
        }
        return
      }

      // 내가 마지막으로 저장한 내용이면 무시 (루프 방지)
      if (data.content === lastSaved.current) return

      isRemote.current = true
      onRemoteChange(data.content)
      isRemote.current = false
    })

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
    }
  }, [user, docId]) // onRemoteChange, content는 의도적으로 제외 (탭 전환 시에만 재구독)

  // 로컬 변경 → Firebase 저장 (300ms 디바운스)
  const syncToRemote = useCallback((newContent: string) => {
    if (isRemote.current) return
    if (!docRef.current) return
    if (newContent === lastSaved.current) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        lastSaved.current = newContent
        await set(docRef.current!, {
          content: newContent,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        })
      } catch (err) {
        console.warn('동기화 대기 중 (오프라인):', err)
      }
    }, 300)
  }, [user])

  return { syncToRemote }
}

function encodeKey(key: string): string {
  return key.replace(/[.#$[\]/]/g, '_')
}

export const goDbOnline  = () => goOnline(db)
export const goDbOffline = () => goOffline(db)
