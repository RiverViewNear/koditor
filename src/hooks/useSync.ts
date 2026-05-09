/**
 * useSync.ts
 * Firebase Realtime Database 실시간 동기화
 * - 오프라인 시 로컬 캐시에 저장 → 온라인 복구 시 자동 동기화
 * - 탭별로 독립적인 문서 관리
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
} from 'firebase/database'
import { db } from '../firebase'
import type { User } from 'firebase/auth'

interface SyncOptions {
  user: User
  docId: string
  content: string           // 초기값 — Firebase에 데이터 없을 때 사용
  onRemoteChange: (content: string) => void
}

export function useSync({ user, docId, content, onRemoteChange }: SyncOptions) {
  const docRef        = useRef<DatabaseReference | null>(null)
  const isRemote      = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved     = useRef<string>('')

  // Firebase 경로: users/{uid}/docs/{docId}
  useEffect(() => {
    if (!user) return
    docRef.current = ref(db, `users/${user.uid}/docs/${encodeKey(docId)}`)

    // 원격 변경 수신
    const unsubscribe = onValue(docRef.current, (snapshot) => {
      const data = snapshot.val()

      if (!data) {
        // Firebase에 데이터가 없으면 현재 에디터 내용을 초기값으로 저장
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

    return () => unsubscribe()
  }, [user, docId, content, onRemoteChange])

  // 로컬 변경 → Firebase에 저장 (300ms 디바운스)
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
        // 오프라인 시 Firebase SDK가 자동으로 큐에 쌓아둠
        console.warn('동기화 대기 중 (오프라인):', err)
      }
    }, 300)
  }, [user])

  return { syncToRemote }
}

// Firebase 키에 사용 불가한 문자 치환 (. # $ [ ] /)
function encodeKey(key: string): string {
  return key.replace(/[.#$[\]/]/g, '_')
}

// 오프라인/온라인 수동 제어 (필요 시 사용)
export const goDbOnline  = () => goOnline(db)
export const goDbOffline = () => goOffline(db)
