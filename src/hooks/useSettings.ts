/**
 * useSettings.ts
 *
 * 사용자 설정 관리
 * - 앱 시작 시 Firebase에서 1회 로드
 * - 설정 변경 시 Firebase에 즉시 저장
 * - 경로: users/{uid}/settings/
 */

import { useState, useEffect, useCallback } from 'react'
import { ref, get, set } from 'firebase/database'
import { db } from '../firebase'
import type { User } from 'firebase/auth'

export interface Settings {
  autoComplete: boolean
  darkMode: boolean
  columnMode: boolean
  sidebarOpen: boolean
  lastFolderPath: string | null
}

const DEFAULT_SETTINGS: Settings = {
  autoComplete: true,
  darkMode: false,
  columnMode: false,
  sidebarOpen: true,
  lastFolderPath: null,
}

export function useSettings(user: User | null) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded]     = useState(false)

  // ── 앱 시작 시 Firebase에서 1회 로드 ─────────────────────
  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        const snap = await get(ref(db, `users/${user.uid}/settings`))
        const data = snap.val()
        if (data) {
          setSettings({ ...DEFAULT_SETTINGS, ...data })
        }
      } catch (err) {
        console.warn('설정 로드 실패:', err)
      } finally {
        setLoaded(true)
      }
    }

    load()
  }, [user])

  // ── 설정 변경 시 Firebase에 즉시 저장 ────────────────────
  const updateSetting = useCallback(async <K extends keyof Settings>(
      key: K,
      value: Settings[K],
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))

    if (!user) return
    try {
      await set(ref(db, `users/${user.uid}/settings/${key}`), value)
    } catch (err) {
      console.warn('설정 저장 실패:', err)
    }
  }, [user])

  return { settings, loaded, updateSetting }
}
