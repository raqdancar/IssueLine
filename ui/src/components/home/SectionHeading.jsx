function SectionHeading({ eyebrow, title, description, align = 'left', className = '' }) {
  const alignClasses = align === 'center' ? 'mx-auto text-center' : ''

  return (
    <div className={`w-full max-w-3xl ${alignClasses} ${className}`}>
      {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.28em] text-red-700">{eyebrow}</p> : null}
      <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p> : null}
    </div>
  )
}

export default SectionHeading
