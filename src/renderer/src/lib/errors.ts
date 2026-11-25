import { i18n } from '@/i18n'

// Errors from the main process are English and come wrapped by Electron
// ("Error invoking remote method 'x': Error: ..."). Common ones get a translated message;
// anything else is shown as is, without the wrapper.
export function errorText(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (\w*Error: )?/,
    '',
  )
  if (/offline mode/i.test(raw)) return i18n.t('errors.offline')
  // Server errors and dropped connections only. A 4xx means something else (bad key, missing file).
  if (
    /\bHTTP (5\d\d|429)\b|fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|\b(TimeoutError|AbortError)\b|\btimed out\b/i.test(
      raw,
    )
  )
    return i18n.t('errors.network')
  return raw
}
