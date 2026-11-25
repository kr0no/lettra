import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  title: string
  width?: number
  onClose: () => void
  children: ReactNode
  actions: ReactNode
}

// Native <dialog>: focus trap, Escape and backdrop for free.
export function Dialog({ title, width = 440, onClose, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first control; a dialog can point it somewhere better.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    // close() hands focus back to whatever had it before the dialog opened.
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      style={{ width }}
      className="m-auto max-w-[calc(100vw-48px)] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/30"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="m-0 text-[15px] font-semibold break-words">{title}</h2>
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed">{children}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{actions}</div>
    </dialog>
  )
}

export const buttonClass = {
  secondary: 'h-7 rounded-md border border-line-strong bg-card px-3 text-[13px] hover:bg-hover',
  primary: 'h-7 rounded-md bg-accent px-3 text-[13px] font-semibold text-white hover:brightness-110',
  danger: 'h-7 rounded-md bg-danger px-3 text-[13px] font-semibold text-white hover:brightness-110',
}
