import { useI18n } from '@/i18n/I18nProvider.jsx'
import IssueCollectedEditionPlaceholderCard from './IssueCollectedEditionPlaceholderCard'

function IssueCollectedEditionsSection({ collectedEditions }) {
  const { t } = useI18n()
  const hasItems = Array.isArray(collectedEditions) && collectedEditions.length > 0

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="title-xs text-slate-900">{t('issueDetails.collected.title')}</h3>
        <p className="body-sm text-slate-600">{t('issueDetails.collected.description')}</p>
      </div>

      {hasItems ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collectedEditions.map((edition) => (
            <article key={edition.id ?? `${edition.title ?? 'edition'}-${edition.format ?? 'format'}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4">
              <p className="body-sm font-semibold text-slate-800">{edition.title}</p>
              {edition.format ? <p className="body-xs text-slate-500">{edition.format}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <IssueCollectedEditionPlaceholderCard />
          <IssueCollectedEditionPlaceholderCard />
          <IssueCollectedEditionPlaceholderCard />
        </div>
      )}
    </section>
  )
}

export default IssueCollectedEditionsSection
