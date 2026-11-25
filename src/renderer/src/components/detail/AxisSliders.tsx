import { useTranslation } from 'react-i18next'
import type { NamedInstance, VariationAxis } from '@shared/types'
import { Section } from './Section'

interface AxisSlidersProps {
  axes: VariationAxis[]
  instances: NamedInstance[]
  values: Record<string, number>
  onChange: (values: Record<string, number>) => void
}

export const axisDefaults = (axes: VariationAxis[]): Record<string, number> =>
  Object.fromEntries(axes.map((a) => [a.tag, a.default]))

export const variationSettings = (values: Record<string, number>): string =>
  Object.entries(values)
    .map(([tag, v]) => `'${tag}' ${v}`)
    .join(', ')

const step = (axis: VariationAxis): number =>
  axis.max - axis.min <= 2 ? 0.01 : axis.max - axis.min <= 20 ? 0.1 : 1

export function AxisSliders({ axes, instances, values, onChange }: AxisSlidersProps) {
  const { t } = useTranslation()
  const matchesInstance = (inst: NamedInstance): boolean =>
    Object.entries(inst.coordinates).every(([tag, v]) => Math.abs((values[tag] ?? 0) - v) < 0.001)

  return (
    <Section
      title={t('detail.axes')}
      aside={
        <button
          type="button"
          onClick={() => onChange(axisDefaults(axes))}
          className="text-xs text-accent-ink hover:underline"
        >
          {t('detail.reset')}
        </button>
      }
    >
      {axes.map((axis) => {
        const value = values[axis.tag] ?? axis.default
        return (
          <label key={axis.tag} className="grid grid-cols-[112px_minmax(0,1fr)_44px] items-center gap-2.5">
            <span className="truncate text-xs" title={`${axis.name} (${axis.tag})`}>
              {axis.name} <span className="font-mono text-[11px] text-muted">{axis.tag}</span>
            </span>
            <input
              type="range"
              min={axis.min}
              max={axis.max}
              step={step(axis)}
              value={value}
              onChange={(e) => onChange({ ...values, [axis.tag]: Number(e.target.value) })}
            />
            <span className="text-right font-mono text-[11px] tabular-nums">
              {Math.round(value * 100) / 100}
            </span>
          </label>
        )
      })}
      {instances.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[11px] text-muted">{t('detail.instances')}</span>
          <div className="flex flex-wrap gap-1.5">
            {instances.map((inst) => {
              const active = matchesInstance(inst)
              return (
                <button
                  key={inst.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...values, ...inst.coordinates })}
                  className={`h-[26px] rounded-[13px] border px-2.5 text-xs ${
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line-strong hover:bg-hover'
                  }`}
                >
                  {inst.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}
