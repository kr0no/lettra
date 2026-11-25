import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { ErrorBoundary, reportError } from './components/ErrorBoundary'
import { i18n, initI18n, resolveLanguage } from './i18n'
import { resetUnavailable } from './lib/google-loader'
import { syncQueries } from './lib/live-queries'
import { listenForInstallProgress } from './stores/install'
import { listenForUpdates } from './stores/update'
import { hydratePreview } from './stores/preview'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    // Data comes from local IPC and is invalidated by main-process events, not by timers.
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
  },
})

window.addEventListener('error', (e) => reportError(e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => reportError(e.reason))

async function bootstrap(): Promise<void> {
  const settings = await window.fontAPI.settingsGet()
  await initI18n(settings.language)
  hydratePreview(settings)
  syncQueries(queryClient)
  listenForInstallProgress()
  listenForUpdates()

  // Apply settings changes live: language, and retrying previews/catalog when going back online.
  let offline = settings.offline
  let language = settings.language
  window.fontAPI.on('settings:changed', (next) => {
    // Every settings save lands here (preview text too); only a real change should re-render everything.
    if (next.language !== language) void i18n.changeLanguage(resolveLanguage((language = next.language)))
    if (offline && !next.offline) {
      resetUnavailable()
      void queryClient.invalidateQueries({ queryKey: ['gf-catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['gf-updates'] })
    }
    offline = next.offline
  })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
