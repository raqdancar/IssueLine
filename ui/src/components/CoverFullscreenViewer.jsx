import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function CoverFullscreenViewer({ open, src, alt = 'Issue cover', onClose }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    setFailed(false)
  }, [src, open])

  if (!open || !src || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-100 bg-black/90 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Cover viewer"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close cover viewer"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex h-full w-full items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
        {failed ? (
          <div className="rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white">
            Unable to load image preview.
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
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
