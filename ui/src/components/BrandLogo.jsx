const BRAND_LOGO_SRC = '/branding/issueline-logo.svg'

function BrandLogo({ alt = '', className = '', loading = 'eager' }) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={className}
      loading={loading}
      aria-hidden={alt ? undefined : 'true'}
    />
  )
}

export { BRAND_LOGO_SRC }
export default BrandLogo
