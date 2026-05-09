import { useState, useEffect } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null)
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
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        alert('팝업이 차단됐습니다.\n브라우저 팝업 허용 후 다시 시도해주세요.')
      } else if (err.code !== 'auth/popup-closed-by-user') {
        console.error('로그인 실패:', err)
      }
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
