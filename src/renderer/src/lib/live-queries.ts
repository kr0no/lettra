import type { QueryClient } from '@tanstack/react-query'

// One subscription per main-process event for the whole app. Hooks used by every card
// (useInstalled, useLocalFonts...) used to subscribe on their own, so a single install
// fired dozens of refetches. Call once at startup.
export function syncQueries(client: QueryClient): void {
  const api = window.fontAPI
  api.on('fonts:changed', () => void client.invalidateQueries({ queryKey: ['local-fonts'] }))
  api.on('gf:installedChanged', (records) => {
    client.setQueryData(['gf-installed'], records)
    void client.invalidateQueries({ queryKey: ['gf-updates'] })
  })
  api.on('library:changed', (library) => client.setQueryData(['library'], library))
  api.on('settings:changed', (settings) => client.setQueryData(['settings'], settings))
}
