import { resolvePrintLanguageBadge } from '@/lib/printLanguage'
import flagEs from 'flagpack-core/lib/flags/s/724.svg'
import flagGb from 'flagpack-core/lib/flags/s/836.svg'

const FLAG_ASSET_BY_CODE = {
  ES: flagEs,
  EN: flagGb,
}

function PrintLanguageBadge({ value, className = '' }) {
  const badge = resolvePrintLanguageBadge(value)
  if (!badge) return null

  const displayText = badge.code ?? badge.label
  const flagAsset = badge.code ? FLAG_ASSET_BY_CODE[badge.code] ?? null : null
  if (!displayText) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-slate-600 ${className}`}
      title={badge.label ?? undefined}
    >
      {flagAsset ? (
        <img
          src={flagAsset}
          alt=""
          aria-hidden="true"
          className="h-2.5 w-4 rounded-[2px] border border-slate-300 object-cover"
          loading="lazy"
        />
      ) : null}
      <span>{displayText}</span>
    </span>
  )
}

export default PrintLanguageBadge
