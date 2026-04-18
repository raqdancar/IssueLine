import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react'

const toolbarButtons = [
  { key: 'haveIt', label: 'Add to collection', Icon: CheckCircle2 },
  { key: 'readIt', label: 'Mark as read', Icon: BookOpen },
]

function TimelineIssueToolbar({
  issueState,
  disabled = false,
  disabledReason,
  pending = false,
  onToggle,
  variant = 'light',
  className = '',
}) {
  const wrapperClasses =
    variant === 'dark'
      ? 'rounded-xl border border-white/15 bg-white/5 p-2'
      : 'rounded-xl border border-slate-200 bg-slate-50/70 p-2'

  const actionBaseClasses =
    variant === 'dark'
      ? 'border-white/20 bg-white/5 text-slate-100 hover:border-white/35 hover:bg-white/10'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-900/30 hover:text-slate-900'

  const activeHaveClasses =
    variant === 'dark'
      ? 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100'
      : 'border-emerald-300 bg-emerald-100 text-emerald-700'

  const activeReadClasses =
    variant === 'dark'
      ? 'border-sky-300/70 bg-sky-500/20 text-sky-100'
      : 'border-sky-300 bg-sky-100 text-sky-700'

  return (
    <div className={`w-full ${wrapperClasses} ${className}`.trim()}>
      <div className="flex flex-wrap justify-end gap-2">
        {toolbarButtons.map(({ key, label, Icon }) => {
          const active = Boolean(issueState?.[key])
          const buttonDisabled = disabled || pending
          const activeClasses = key === 'haveIt' ? activeHaveClasses : activeReadClasses
          const titleText = pending ? 'Saving your update...' : disabled ? disabledReason ?? 'Issue actions unavailable' : undefined
          const buttonLabel = pending ? 'Saving...' : label

          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-busy={pending ? 'true' : undefined}
              aria-label={buttonLabel}
              disabled={buttonDisabled}
              title={titleText}
              onClick={() => onToggle?.(key, !active)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                variant === 'dark' ? 'focus-visible:ring-white/50' : 'focus-visible:ring-slate-400'
              } ${active ? activeClasses : actionBaseClasses} ${buttonDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{buttonLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TimelineIssueToolbar
