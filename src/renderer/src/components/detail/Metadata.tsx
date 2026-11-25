import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderSearch, Trash2 } from 'lucide-react'
import type { LocalFace } from '@shared/types'
import { confirmUninstall } from '../dialogs/Dialogs'
import { Section } from './Section'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words select-text">{children}</dd>
    </>
  )
}

export function Metadata({ face }: { face: LocalFace }) {
  const { t } = useTranslation()
  const format = face.format.toUpperCase() + (face.isVariable ? ` · ${t('detail.variable')}` : '')
  return (
    <Section title={t('detail.file')}>
      <dl className="m-0 grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <Row label={t('detail.source')}>{t(`source.${face.source}`)}</Row>
        <Row label={t('detail.format')}>{format}</Row>
        <Row label={t('detail.postscript')}>
          <span className="font-mono text-[11px]">{face.postscriptName}</span>
        </Row>
        {face.version && <Row label={t('detail.version')}>{face.version}</Row>}
        {face.designer && <Row label={t('detail.designer')}>{face.designer}</Row>}
        {face.collectionIndex !== null && (
          <Row label={t('detail.collection')}>
            {t('detail.collectionValue', { index: face.collectionIndex + 1 })}
          </Row>
        )}
        {face.duplicateFaceIds.length > 0 && (
          <Row label={t('detail.duplicates')}>
            <span className="text-warning">
              {t('detail.duplicatesValue', { count: face.duplicateFaceIds.length })}
            </span>
          </Row>
        )}
        <Row label={t('detail.location')}>
          <span className="font-mono text-[11px] break-all">{face.filePath}</span>
        </Row>
      </dl>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => void window.fontAPI.fontsReveal(face.id)}
          className="flex h-[28px] items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 text-xs hover:bg-hover"
        >
          <FolderSearch size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('detail.reveal')}
        </button>
        {face.removable && (
          <button
            type="button"
            onClick={() =>
              void confirmUninstall(`${face.familyName} ${face.styleName}`, { faceIds: [face.id] })
            }
            className="flex h-[28px] items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 text-xs hover:bg-hover"
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('detail.uninstallStyle')}
          </button>
        )}
      </div>
    </Section>
  )
}
