import { footerConfig, footerLinks } from '@/lib/footerConfig'

const linkBaseClasses =
  'rounded-sm text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/70" aria-label="Site footer">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-10 xl:px-16 2xl:px-24">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800">{footerConfig.brand}</p>
          <p>{footerConfig.tagline}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 lg:justify-center" aria-label="Footer links">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={linkBaseClasses}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noreferrer noopener' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="space-y-1 lg:text-right">
          <p>{footerConfig.legal}</p>
          <p>{footerConfig.disclaimer}</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
