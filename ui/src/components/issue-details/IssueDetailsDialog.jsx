import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { buildIssueImageUrl } from '@/lib/issueImages'
import { useIssueDetailsQuery } from '@/hooks/useIssueDetails.js'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import IssueDetailsHeader from './IssueDetailsHeader'
import IssueMetadataPanel from './IssueMetadataPanel'
import IssueCollectedEditionsSection from './IssueCollectedEditionsSection'

const resolveCoverImage = (issue, fallbackImage) => {
  if (!issue) return fallbackImage ?? null
  const coverFromStorage = buildIssueImageUrl(issue.images?.coverImagePath)
  return coverFromStorage ?? issue.images?.cover ?? issue.images?.coverOriginal ?? fallbackImage ?? null
}

function IssueDetailsDialog({ open, heroSlug, issueId, fallbackImage, onClose }) {
  const { t } = useI18n()
  const query = useIssueDetailsQuery({
    heroSlug,
    issueId,
    enabled: open && Boolean(issueId),
  })

  const issue = query.data?.issue ?? null
  const collectedEditions = query.data?.collectedEditions ?? []
  const coverImage = useMemo(() => resolveCoverImage(issue, fallbackImage), [issue, fallbackImage])
  const coverAlt = issue?.headline ?? issue?.issue?.title ?? t('common.issueCover')

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/75 px-3 py-4 md:items-center md:px-6 md:py-8"
      onClick={onClose}
    >
      <div className="w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/30 sm:p-6">
          <IssueDetailsHeader issue={issue} onClose={onClose} />

          {query.isLoading ? (
            <div className="space-y-4 py-4">
              <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : query.isError ? (
            <div className="space-y-3 py-6">
              <p className="body-sm text-rose-600">{query.error?.message ?? t('issueDetails.loadError')}</p>
              <Button type="button" variant="outline" onClick={() => query.refetch()}>
                {t('issueDetails.retry')}
              </Button>
            </div>
          ) : !issue ? (
            <p className="body-sm py-6 text-slate-500">{t('issueDetails.empty')}</p>
          ) : (
            <div className="space-y-6 py-4">
              <section className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
                <div className="mx-auto w-full max-w-[180px] sm:max-w-[210px] lg:mx-0 lg:max-w-[200px]">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="aspect-2/3">
                      {coverImage ? (
                        <img src={coverImage} alt={coverAlt} className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-4 text-center">
                          <p className="body-sm text-slate-500">{t('issueDetails.coverMissing')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <IssueMetadataPanel issue={issue} />
                </div>
              </section>
              <IssueCollectedEditionsSection collectedEditions={collectedEditions} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default IssueDetailsDialog
