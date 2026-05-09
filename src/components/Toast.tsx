/**
 * Toast.tsx
 * 에러/알림 메시지 표시
 */

import { useEffect } from 'react'
import './Toast.css'

export type ToastType = 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

export function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div className={`toast toast--${toast.type}`} onClick={() => onRemove(toast.id)}>
      <span className="toast__icon">
        {toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ'}
      </span>
      <span className="toast__message">{toast.message}</span>
    </div>
  )
}
