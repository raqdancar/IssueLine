// Render the stage details modal with summary and related issue strip.
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalLayer } from '@/hooks/useModalLayer.js'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import StageIssuesTimeline from './StageIssuesTimeline'

// Modal dialog that shows one stage summary and its issue timeline strip.
function StageDetailDialog({ open, onClose, stage = null, issues = [], onIssueSelect, portalContainer }) {
  const { t } = useI18n()
  useModalLayer({ open, onClose, lockScroll: true, closeOnEscape: true })

  if (!open || typeof document === 'undefined' || !stage) return null
  const portalTarget = portalContainer ?? document.body

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center bg-slate-950/70 px-3 py-4 md:items-center md:px-6 md:py-8"
      onClick={(event) => {
        event.stopPropagation()
        onClose?.()
      }}
    >
      <div className="w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/30 sm:p-6">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <p className="eyebrow text-slate-500">{t('timeline.stage')}</p>
              <h3 className="title-sm text-slate-900">{stage.name}</h3>
              <p className="body-xs text-slate-500">
                {stage.yearLabel} - {t('timeline.trackedIssues', { count: stage.issueCount ?? issues.length })}
              </p>
              {stage.summary ? <p className="body-xs text-slate-600">{stage.summary}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-500 transition hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{t('issueDetails.closeDialog')}</span>
            </button>
          </header>

          <div className="mt-5">
            <StageIssuesTimeline issues={issues} onIssueSelect={onIssueSelect} />
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}

export default StageDetailDialog
