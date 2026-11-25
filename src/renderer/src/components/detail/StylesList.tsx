import { useTranslation } from 'react-i18next'
import type { LocalFace } from '@shared/types'
import { FontPreview } from '../browse/FontPreview'
import { Section } from './Section'

interface StylesListProps {
  faces: LocalFace[]
  selectedId: string
  text: string
  onSelect: (id: string) => void
}

export function StylesList({ faces, selectedId, text, onSelect }: StylesListProps) {
  const { t } = useTranslation()
  return (
    <Section title={`${t('detail.styles')} · ${faces.length}`}>
      <div className="-mx-2 flex flex-col">
        {faces.map((face) => {
          const selected = face.id === selectedId
          return (
            <button
              key={face.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(face.id)}
              className={`flex min-h-10 items-center gap-3 rounded-md px-2 py-1 text-left ${
                selected ? 'bg-accent-soft' : 'hover:bg-hover'
              }`}
            >
              <span className="flex w-[104px] shrink-0 flex-col">
                <span
                  className={`truncate text-xs ${selected ? 'font-semibold text-accent-ink' : 'text-muted'}`}
                >
                  {face.styleName}
                </span>
                {/* Copies of the same font would otherwise be identical rows. */}
                {face.duplicateFaceIds.length > 0 && (
                  <span className="truncate text-[11px] text-muted" title={face.filePath}>
                    {t(`source.${face.source}`)} · {face.filePath.split('/').pop()}
                  </span>
                )}
              </span>
              <FontPreview
                face={face}
                text={text}
                size={22}
                className="min-w-0 flex-1 truncate leading-[1.25]"
              />
            </button>
          )
        })}
      </div>
    </Section>
  )
}
