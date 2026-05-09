/**
 * useAuth.ts
 * 구글 로그인/로그아웃 + 인증 상태 관리
 */

import { useState, useEffect } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('로그인 실패:', err)
    }
  }

  const signOutUser = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('로그아웃 실패:', err)
    }
  }

  return { user, loading, signIn, signOut: signOutUser }
}
