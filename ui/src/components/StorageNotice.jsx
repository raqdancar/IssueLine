// Renderitza un component reutilitzable de la interfície d'IssueLine.
import { useEffect, useState } from 'react'
import { Database, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const STORAGE_NOTICE_KEY = 'issueline_storage_notice_ack'

function StorageNotice() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setVisible(window.localStorage.getItem(STORAGE_NOTICE_KEY) !== 'true')
  }, [])

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_NOTICE_KEY, 'true')
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-2xl shadow-slate-900/20 sm:bottom-5 sm:p-5"
      aria-label={t('storageNotice.ariaLabel')}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Database className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">{t('storageNotice.title')}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t('storageNotice.body')}</p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" size="sm" onClick={handleDismiss}>
              {t('storageNotice.accept')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/privacy">{t('storageNotice.learnMore')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default StorageNotice
