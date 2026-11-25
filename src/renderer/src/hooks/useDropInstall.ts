import { useEffect, useState } from 'react'
import { i18n } from '@/i18n'
import { useFeedback } from '@/stores/feedback'
import { errorText } from '@/lib/errors'

const hasFiles = (e: DragEvent): boolean => Boolean(e.dataTransfer?.types.includes('Files'))

/**
 * Window-wide drop target: dropping font files or folders installs them into the
 * user font folder. Returns whether a drag is over the window (to show the overlay).
 */
export function useDropInstall(): boolean {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let depth = 0 // dragenter/leave fire for every child element
    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault() // required to allow dropping (and stops Chromium opening the file)
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const paths = [...(e.dataTransfer?.files ?? [])]
        .map((f) => window.fontAPI.pathForFile(f))
        .filter(Boolean)
      if (paths.length) void install(paths)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return dragging
}

async function install(paths: string[]): Promise<void> {
  const { toast } = useFeedback.getState()
  const t = i18n.t.bind(i18n)
  try {
    const result = await window.fontAPI.fontsInstallFiles(paths)
    const skipped = result.skipped.length
    if (result.installed.length) {
      toast({
        tone: skipped ? 'warning' : 'info',
        message: t('drop.installed', { count: result.installed.length }),
        ...(skipped ? { detail: t('drop.skipped', { count: skipped }) } : {}),
      })
    } else {
      const already = result.skipped.every((s) => s.reason === 'already-installed') && skipped > 0
      toast({
        tone: 'warning',
        message: already ? t('drop.alreadyInstalled', { count: skipped }) : t('drop.nothing'),
        detail: result.skipped
          .map((s) => s.name)
          .slice(0, 4)
          .join(', '),
      })
    }
  } catch (e) {
    toast({ tone: 'warning', message: t('drop.failed'), detail: errorText(e) })
  }
}
