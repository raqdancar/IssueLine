// Renderitza parts del dialeg de detall d'un issue i les seves edicions.
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

// Header area for the issue-details modal, including quick state-action buttons.
function IssueDetailsHeader({
  issue,
  onClose,
  previousIssueId,
  nextIssueId,
  onIssueNavigate,
  actionButtons = [],
  actionsDisabled = false,
  actionsPending = false,
  actionsDisabledReason,
}) {
  const { t } = useI18n()
  const issueNumber = issue?.issue?.number
  const fallbackTitle = issueNumber ? t('timeline.issueLabel', { number: issueNumber }) : t('issueDetails.title')
  const title = issue?.headline ?? issue?.issue?.title ?? fallbackTitle
  const subtitle = issue?.series?.title ?? issue?.issueCode ?? null

  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="space-y-1">
        <p className="eyebrow text-slate-500">{t('issueDetails.eyebrow')}</p>
        <h2 className="title-sm text-slate-900">{title}</h2>
        {subtitle ? <p className="body-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <nav className="flex items-center gap-1" aria-label={t('issueDetails.timelineNavigation')}>
          <button
            type="button"
            disabled={!previousIssueId || !onIssueNavigate}
            title={t('issueDetails.previousIssue')}
            aria-label={t('issueDetails.previousIssue')}
            onClick={() => onIssueNavigate?.(previousIssueId)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary/50 hover:bg-accent/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!nextIssueId || !onIssueNavigate}
            title={t('issueDetails.nextIssue')}
            aria-label={t('issueDetails.nextIssue')}
            onClick={() => onIssueNavigate?.(nextIssueId)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary/50 hover:bg-accent/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
        <div className="flex items-center gap-2">
          {/* Action buttons (have/read) share disabled/pending state from the parent dialog. */}
          {actionButtons.map(({ key, active, icon: Icon, label, onClick }) => {
            const buttonDisabled = actionsDisabled || actionsPending
            const titleText = actionsPending
              ? t('timeline.savingUpdate')
              : actionsDisabled
                ? actionsDisabledReason ?? t('timeline.issueActionsUnavailable')
                : label

            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-label={actionsPending ? t('timeline.saving') : label}
                aria-busy={actionsPending ? 'true' : undefined}
                disabled={buttonDisabled}
                title={titleText}
                onClick={onClick}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  active
                    ? key === 'haveIt'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                      : 'border-sky-300 bg-sky-100 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/30 hover:text-slate-900'
                } ${buttonDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {actionsPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{t('issueDetails.closeDialog')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default IssueDetailsHeader
