import { useCallback, useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { GoogleFamily } from '@shared/types'
import type { FaceSnapshot } from '@/lib/font-loader'
import {
  getGoogleSnapshot,
  googleEntryId,
  requestGoogleFace,
  retainGoogleFace,
  subscribeGoogle,
  variantStyle,
  variantWeight,
} from '@/lib/google-loader'

const PENDING: FaceSnapshot = { family: '', state: 'loading' }

interface GooglePreviewProps {
  family: GoogleFamily
  variant: string
  text: string
  size: number
  className?: string
  style?: CSSProperties
}

export function GooglePreview({ family, variant, text, size, className = '', style }: GooglePreviewProps) {
  const { t } = useTranslation()
  const id = googleEntryId(family, variant)
  const read = useCallback(() => getGoogleSnapshot(id), [id])
  const entry = useSyncExternalStore(subscribeGoogle, read)
  const missing = entry === undefined
  // Request when there's no entry yet, including after one was dropped (evicted, or reset after going back online).
  useEffect(() => {
    if (missing) requestGoogleFace(family, variant, text)
    return retainGoogleFace(googleEntryId(family, variant))
  }, [missing, family, variant, text])
  const { family: alias, state } = entry ?? PENDING

  if (state === 'unavailable') {
    return (
      <div className={`${className} text-[13px] text-muted italic`}>{t('google.previewUnavailable')}</div>
    )
  }
  return (
    <div
      dir="auto"
      className={className}
      style={{
        ...style,
        fontSize: size,
        fontFamily: alias ? `"${alias}", system-ui` : undefined,
        fontWeight: variantWeight(variant),
        fontStyle: variantStyle(variant),
        visibility: state === 'ready' ? 'visible' : 'hidden',
      }}
    >
      {text}
    </div>
  )
}
