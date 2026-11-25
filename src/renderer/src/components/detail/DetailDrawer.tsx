import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, X } from 'lucide-react'
import type { LocalFamily } from '@shared/types'
import { DEFAULT_PREVIEW_TEXT } from '@shared/defaults'
import { representative, visibleFaces } from '@/lib/families'
import { usePreview } from '@/stores/preview'
import { FontPreview } from '../browse/FontPreview'
import { SourceBadges } from '../browse/SourceBadges'
import { FamilyActions } from '../browse/FamilyActions'
import { confirmUninstall } from '../dialogs/Dialogs'
import { CollectionMenu } from '../library/CollectionMenu'
import { AxisSliders, axisDefaults, variationSettings } from './AxisSliders'
import { GlyphGrid } from './GlyphGrid'
import { Metadata } from './Metadata'
import { StylesList } from './StylesList'
import { Waterfall } from './Waterfall'

interface DetailDrawerProps {
  family: LocalFamily
  onClose: () => void
}

/** Right-hand drawer. Mount with key={family.key} so face/axis state resets per family. */
export function DetailDrawer({ family, onClose }: DetailDrawerProps) {
  const { t } = useTranslation()
  const previewText = usePreview((s) => s.text)
  const faces = visibleFaces(family)
  const [faceId, setFaceId] = useState(() => representative(family)?.id ?? faces[0]?.id ?? '')
  const face = faces.find((f) => f.id === faceId) ?? faces[0]
  const [axisValues, setAxisValues] = useState<Record<string, number>>(() => axisDefaults(face?.axes ?? []))
  if (!face) return null

  const selectFace = (id: string): void => {
    setFaceId(id)
    setAxisValues(axisDefaults(faces.find((f) => f.id === id)?.axes ?? []))
  }
  const variation = face.isVariable && face.axes?.length ? variationSettings(axisValues) : undefined
  const text = previewText || DEFAULT_PREVIEW_TEXT

  return (
    <aside
      aria-label={family.name}
      className="flex w-[420px] shrink-0 max-[1240px]:w-[360px] animate-[drawer-in_160ms_ease-out] flex-col border-l border-line bg-surface"
    >
      <div className="drag flex shrink-0 items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
        <div className="min-w-0 flex-1">
          <FontPreview
            face={representative(family)}
            text={family.name}
            size={28}
            className="truncate leading-[1.2]"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">{t('browse.styles', { count: faces.length })}</span>
            <SourceBadges family={family} />
            {face.isVariable && (
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-ink">
                {t('detail.variable')}
              </span>
            )}
            {!family.removable && (
              <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
                {t('detail.readOnly')}
              </span>
            )}
          </div>
        </div>
        <span className="no-drag flex shrink-0 items-center">
          <FamilyActions familyKey={family.key} name={family.name} persistent />
          <CollectionMenu familyKey={family.key} />
        </span>
        {family.removable && (
          <button
            type="button"
            aria-label={t('detail.uninstallFamily')}
            title={t('detail.uninstallFamily')}
            onClick={() => void confirmUninstall(family.name, { familyKey: family.key })}
            className="no-drag grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
          >
            <Trash2 size={15} />
          </button>
        )}
        <button
          type="button"
          aria-label={t('detail.close')}
          title={t('detail.close')}
          onClick={onClose}
          className="no-drag grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {face.isVariable && face.axes && face.axes.length > 0 && (
          <AxisSliders
            axes={face.axes}
            instances={face.instances ?? []}
            values={axisValues}
            onChange={setAxisValues}
          />
        )}
        <Waterfall face={face} text={text} variation={variation} />
        <StylesList
          faces={faces}
          selectedId={face.id}
          text={previewText || family.name}
          onSelect={selectFace}
        />
        <GlyphGrid face={face} variation={variation} />
        <Metadata face={face} />
      </div>
    </aside>
  )
}
