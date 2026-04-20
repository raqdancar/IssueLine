import { useI18n } from '@/i18n/I18nProvider.jsx'
import { buildPublicStorageUrl } from '@/lib/issueImages'
import IssueCollectedEditionPlaceholderCard from './IssueCollectedEditionPlaceholderCard'

const COLLECTED_EDITION_IMAGE_BUCKET = import.meta.env.VITE_COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collectedEditions.map((edition) => {
            const resolvedCoverImage = buildPublicStorageUrl(edition.coverImageUrl, COLLECTED_EDITION_IMAGE_BUCKET)

            return (
              <article
                key={edition.id ?? `${edition.title ?? 'edition'}-${edition.format ?? 'format'}`}
                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="flex gap-3 p-3">
                <div className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="relative h-full w-full overflow-hidden rounded-md bg-linear-to-br from-slate-900 to-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.35)]">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[4px] bg-linear-to-b from-slate-950 via-slate-700 to-slate-900"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 right-0 w-[3px] bg-linear-to-b from-slate-100 via-white to-slate-200 opacity-80"
                    />
                    <div className="absolute inset-[4px] overflow-hidden rounded-[4px] border border-white/20 bg-white/5">
                      {resolvedCoverImage ? (
                        <img
                          src={resolvedCoverImage}
                          alt={edition.title ?? t('issueDetails.collected.placeholderTitle')}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center">
                          <span className="body-xs text-slate-500">{t('timeline.noCover')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="body-sm font-semibold text-slate-800 break-words">
                    {edition.title ?? t('issueDetails.collected.placeholderTitle')}
                  </p>
                  <p>
                    <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                      {edition.format ?? 'unknown'}
                    </span>
                  </p>
                  {edition.subtitle ? <p className="body-xs text-slate-600 break-words">{edition.subtitle}</p> : null}
                  <p className="body-xs text-slate-500">
                    {edition.publicationDate ?? '-'}
                  </p>
                    {edition.publisher ? <p className="body-xs text-slate-500 break-words">{edition.publisher}</p> : null}
                    {edition.notes ? <p className="body-xs text-slate-600 break-words">{edition.notes}</p> : null}
                  </div>
                </div>
                {edition.sourceUrl ? (
                  <div className="border-t border-slate-200 bg-white px-3 py-2">
                    <a
                      href={edition.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="body-xs font-semibold text-indigo-700 underline"
                    >
                      {t('issueDetails.openSource')}
                    </a>
                  </div>
                ) : null}
                {edition.isbn ? (
                  <div className="border-t border-slate-200 bg-white px-3 py-2">
                    <p className="body-xs text-slate-500">ISBN: {edition.isbn}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
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
