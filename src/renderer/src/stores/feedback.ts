import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  detail?: string
  tone: 'info' | 'warning'
}

interface Confirm {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

interface FeedbackState {
  toasts: Toast[]
  confirm: Confirm | null
  toast: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  ask: (confirm: Confirm) => void
  closeConfirm: () => void
}

let nextId = 1

export const useFeedback = create<FeedbackState>()((set, get) => ({
  toasts: [],
  confirm: null,
  toast: (toast) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }))
    setTimeout(() => get().dismiss(id), toast.tone === 'warning' ? 8000 : 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  ask: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
}))
