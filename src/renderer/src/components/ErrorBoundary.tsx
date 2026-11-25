import { Component, type ErrorInfo, type ReactNode } from 'react'
import { i18n } from '@/i18n'

export function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack ?? '') : ''
  void window.fontAPI.appLogError(message, stack).catch(() => undefined)
}

interface State {
  error: Error | null
}

// Without this a render error leaves an empty window.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(Object.assign(error, { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }))
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const t = i18n.t.bind(i18n)
    return (
      <div className="drag grid h-full place-items-center bg-surface p-8">
        <div className="no-drag flex max-w-[440px] flex-col items-center gap-3 text-center">
          <h1 className="m-0 text-[15px] font-semibold">{t('error.title')}</h1>
          <p className="m-0 text-[13px] text-muted">{t('error.body')}</p>
          <code className="max-w-full truncate rounded-md bg-field px-2 py-1 font-mono text-xs text-muted select-text">
            {error.message}
          </code>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-1 h-7 rounded-md bg-accent px-3 text-[13px] font-semibold text-white hover:brightness-110"
          >
            {t('error.reload')}
          </button>
        </div>
      </div>
    )
  }
}
