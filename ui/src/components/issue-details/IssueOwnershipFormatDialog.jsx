// Modal used to select which collected editions the user owns for one issue.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, PackageCheck, X } from 'lucide-react'
import { useModalLayer } from '@/hooks/useModalLayer.js'
import { buildPublicStorageUrl } from '@/lib/issueImages'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import PrintLanguageBadge from '@/components/PrintLanguageBadge'

const COLLECTED_EDITION_IMAGE_BUCKET = import.meta.env.VITE_COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'

const resolveCollectedCoverImage = (value) => buildPublicStorageUrl(value, COLLECTED_EDITION_IMAGE_BUCKET)

function IssueOwnershipFormatDialog({
  open,
  portalContainer,
  issueTitle,
  editions = [],
  selectedEditionIds = [],
  loading = false,
  saving = false,
  error = null,
  onClose,
  onToggleEdition,
  onConfirm,
}) {
  const { t } = useI18n()
  // Prevent accidental close from the same tap/click that opened the modal.
  const [canCloseBackdrop, setCanCloseBackdrop] = useState(false)

  useModalLayer({ open, onClose, lockScroll: true, closeOnEscape: true })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    // Avoid immediate close from the same click/tap that opened the modal.
    setCanCloseBackdrop(false)
    const timer = window.setTimeout(() => setCanCloseBackdrop(true), 120)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null
  const portalTarget = portalContainer ?? document.body

  const selectedSet = new Set(selectedEditionIds)

  return createPortal(
    <div
      className="fixed inset-0 z-130 flex items-center justify-center bg-slate-950/65 px-3 py-4"
      onClick={() => {
        if (!canCloseBackdrop) return
        onClose?.()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/25 sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <p className="eyebrow text-slate-500">{t('issueDetails.ownershipDialog.eyebrow')}</p>
            <h3 className="title-sm text-slate-900">{t('issueDetails.ownershipDialog.title')}</h3>
            {issueTitle ? <p className="body-xs mt-1 text-slate-500">{issueTitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{t('issueDetails.closeDialog')}</span>
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('issueDetails.ownershipDialog.loading')}
            </div>
          ) : editions.length ? (
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {editions.map((edition) => {
                const selected = selectedSet.has(edition.id)
                const coverImage = resolveCollectedCoverImage(edition.coverImageUrl)
                return (
                  <label
                    key={edition.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${
                      selected ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={selected}
                      onChange={(event) => onToggleEdition?.(edition.id, event.target.checked)}
                      disabled={saving}
                    />
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={edition.title ? `${edition.title} cover` : ''}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">N/A</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 wrap-break-word">
                        {edition.title ?? t('issueDetails.collected.placeholderTitle')}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span>{edition.format ?? 'unknown'}</span>
                        <PrintLanguageBadge value={edition.printLanguage ?? edition.print_language} />
                        {edition.publicationDate ? <span>{edition.publicationDate}</span> : null}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              {t('issueDetails.ownershipDialog.noCollectedEditions')}
            </p>
          )}
          {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {t('issueDetails.ownershipDialog.confirm')}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}

export default IssueOwnershipFormatDialog
