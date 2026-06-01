// Renderitza un component reutilitzable de la interfície d'IssueLine.
import { Link } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import { footerLinks } from '@/lib/footerConfig'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const linkBaseClasses =
  'rounded-sm text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

function Footer() {
  const { t } = useI18n()

  return (
    <footer className="mt-auto border-t border-white/10 bg-slate-950 text-slate-300" aria-label={t('footer.ariaSiteFooter')}>
      <div className="mx-auto grid w-full max-w-400 gap-8 px-4 py-10 text-xs sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-10 xl:px-16 2xl:px-24">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-12 w-12 shrink-0" loading="lazy" />
            <p className="text-lg font-black text-white">{t('common.appName')}</p>
          </div>
          <p className="max-w-sm leading-6 text-slate-400">{t('footer.tagline')}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-center" aria-label={t('footer.ariaFooterLinks')}>
          {footerLinks.map((link) =>
            link.external ? (
              <a
                key={link.labelKey}
                href={link.href}
                className={linkBaseClasses}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t(link.labelKey)}
              </a>
            ) : (
              <Link key={link.labelKey} to={link.href} className={linkBaseClasses}>
                {t(link.labelKey)}
              </Link>
            ),
          )}
        </nav>

        <div className="space-y-2 lg:text-right">
          <p className="font-semibold text-slate-200">{t('footer.legal')}</p>
          <p className="leading-6 text-slate-400">{t('footer.disclaimer')}</p>
          <p className="leading-6 text-slate-500">{t('footer.gcdAttribution')}</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
