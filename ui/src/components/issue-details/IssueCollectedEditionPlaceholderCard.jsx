// Renderitza parts del dialeg de detall d'un issue i les seves edicions.
import { useI18n } from '@/i18n/I18nProvider.jsx'

// Empty-state card shown when an issue has no linked collected editions yet.
function IssueCollectedEditionPlaceholderCard() {
  const { t } = useI18n()

  return (
    <article className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4">
      {/* Visual placeholder for a missing collected-edition cover. */}
      <div className="mx-auto mb-3 h-24 w-16 rounded-md border border-slate-200 bg-white" />
      <p className="body-sm font-semibold text-slate-700">{t('issueDetails.collected.placeholderTitle')}</p>
      <p className="body-xs mt-1 text-slate-500">{t('issueDetails.collected.placeholderBody')}</p>
    </article>
  )
}

export default IssueCollectedEditionPlaceholderCard
