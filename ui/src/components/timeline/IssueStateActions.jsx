import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const ISSUE_STATE_TOGGLES = [
  { key: 'haveIt', labelKey: 'timeline.haveIt', Icon: CheckCircle2 },
  { key: 'readIt', labelKey: 'timeline.readIt', Icon: BookOpen },
]

function IssueStateActions({ issueState, disabled, disabledReason, pending, onToggle }) {
  const { t } = useI18n()

  return (
    <div
      className="mt-3 flex flex-wrap gap-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {ISSUE_STATE_TOGGLES.map(({ key, labelKey, Icon }) => {
        const active = Boolean(issueState?.[key])
        const isContextDisabled = disabled
        const isPending = pending
        const buttonDisabled = isContextDisabled || isPending
        const stateClasses = isPending
          ? 'cursor-progress opacity-80'
          : isContextDisabled
            ? 'cursor-not-allowed opacity-60'
            : ''
        const titleText = isPending
          ? t('timeline.savingUpdate')
          : isContextDisabled
            ? disabledReason ?? t('timeline.issueStatesUnavailable')
            : undefined

        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            aria-busy={isPending ? 'true' : undefined}
            disabled={buttonDisabled}
            onClick={(event) => {
              event.stopPropagation()
              onToggle?.(key, !active)
            }}
            onKeyDown={(event) => event.stopPropagation()}
            title={titleText}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              active
                ? 'border-slate-900 bg-slate-900 text-white shadow'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/40 hover:text-slate-900'
            } ${stateClasses}`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isPending ? t('timeline.saving') : t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}

export default IssueStateActions
