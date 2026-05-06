// Render a mobile-only fullscreen cover preview modal with escape/overlay close.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalLayer } from '@/hooks/useModalLayer.js'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function CoverFullscreenViewer({ open, src, alt, onClose }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)

  useModalLayer({ open, onClose, lockScroll: true, closeOnEscape: true })

  useEffect(() => {
    // Reset load-failure state when opening a different cover.
    setFailed(false)
  }, [src, open])

  if (!open || !src || typeof document === 'undefined') return null
  const resolvedAlt = alt ?? t('common.issueCover')

  return createPortal(
    <div
      className="fixed inset-0 z-100 bg-black/90 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t('timeline.coverViewer')}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('timeline.closeCoverViewer')}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex h-full w-full items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
        {failed ? (
          <div className="rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white">
            {t('timeline.coverPreviewError')}
          </div>
        ) : (
          <img
            src={src}
            alt={resolvedAlt}
            onError={() => setFailed(true)}
            className="h-[94vh] w-auto max-w-[96vw] rounded-md object-contain shadow-2xl"
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

export default CoverFullscreenViewer
