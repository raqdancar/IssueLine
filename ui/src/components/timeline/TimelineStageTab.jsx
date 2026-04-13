const variantClasses = {
  light: 'bg-indigo-50/90 text-indigo-800 ring-indigo-100',
  dark: 'bg-emerald-400/20 text-emerald-50 ring-emerald-300/30',
}

function TimelineStageTab({ label, variant = 'light' }) {
  if (!label) {
    return null
  }

  const variantClass = variantClasses[variant] ?? variantClasses.light

  return (
    <div
      className={`flex min-w-[36px] flex-col items-center justify-center self-stretch px-1 shadow-inner ring-1 transition ${variantClass}`}
      aria-label={`Stage ${label}`}
      title={label}
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
    >
      <span className="max-h-full overflow-hidden text-ellipsis text-[10px] font-black tracking-[0.45em]">
        {label}
      </span>
    </div>
  )
}

export default TimelineStageTab



