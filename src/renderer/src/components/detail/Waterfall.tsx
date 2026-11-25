import { useTranslation } from 'react-i18next'
import type { LocalFace } from '@shared/types'
import { FontPreview } from '../browse/FontPreview'
import { Section } from './Section'

const SIZES = [12, 16, 20, 24, 32, 40, 48, 64]

export function Waterfall({ face, text, variation }: { face: LocalFace; text: string; variation?: string }) {
  const { t } = useTranslation()
  return (
    <Section title={t('detail.waterfall')}>
      {SIZES.map((size) => (
        <div key={size} className="flex min-w-0 items-baseline gap-3">
          <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">
            {size}
          </span>
          <FontPreview
            face={face}
            text={text}
            size={size}
            variation={variation}
            className="min-w-0 flex-1 truncate leading-[1.2]"
          />
        </div>
      ))}
    </Section>
  )
}
