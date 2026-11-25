import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalFace } from '@shared/types'
import { useLocalFontFace } from '@/hooks/useFontFace'

interface FontPreviewProps {
  face: LocalFace | undefined
  text: string
  size: number
  className?: string
  style?: CSSProperties
  /** Extra font-variation-settings, e.g. from the axis sliders. */
  variation?: string
}

// Text stays hidden while the face loads to avoid a flash of the system font.
export function FontPreview({ face, text, size, className = '', style, variation }: FontPreviewProps) {
  const { t } = useTranslation()
  const { family, state } = useLocalFontFace(face)
  // Without this, variable fonts render at whatever instance Chromium picks (often the heaviest).
  const settings =
    variation ??
    (face?.isVariable && face.axes?.length
      ? face.axes.map((a) => `'${a.tag}' ${a.default}`).join(', ')
      : undefined)
  if (state === 'unavailable') {
    return <div className={`${className} text-[13px] text-muted italic`}>{t('browse.unavailable')}</div>
  }
  return (
    <div
      dir="auto"
      className={className}
      style={{
        ...style,
        fontSize: size,
        fontFamily: family ? `"${family}", system-ui` : undefined,
        fontVariationSettings: settings,
        visibility: state === 'ready' ? 'visible' : 'hidden',
      }}
    >
      {text}
    </div>
  )
}
