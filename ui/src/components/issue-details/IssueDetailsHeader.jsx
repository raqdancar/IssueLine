import { X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function IssueDetailsHeader({ issue, onClose }) {
  const { t } = useI18n()
  const issueNumber = issue?.issue?.number
  const fallbackTitle = issueNumber ? t('timeline.issueLabel', { number: issueNumber }) : t('issueDetails.title')
  const title = issue?.headline ?? issue?.issue?.title ?? fallbackTitle
  const subtitle = issue?.series?.title ?? issue?.issueCode ?? null

  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div className="space-y-1">
        <p className="eyebrow text-slate-500">{t('issueDetails.eyebrow')}</p>
        <h2 className="title-sm text-slate-900">{title}</h2>
        {subtitle ? <p className="body-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{t('issueDetails.closeDialog')}</span>
      </button>
    </header>
  )
}

export default IssueDetailsHeader
