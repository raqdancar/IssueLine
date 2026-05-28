// Render a randomized layered cover fan for archive-style character panels.
import { useMemo } from 'react'

const shuffleArray = (input) => {
  const clone = [...input]
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const tmp = clone[index]
    clone[index] = clone[randomIndex]
    clone[randomIndex] = tmp
  }
  return clone
}

const fanSlots = [
  { x: '-132%', y: '18%', rotate: '-16deg', scale: 0.72, opacity: 0.28, zIndex: 1 },
  { x: '-78%', y: '7%', rotate: '-9deg', scale: 0.84, opacity: 0.55, zIndex: 2 },
  { x: '0%', y: '0%', rotate: '0deg', scale: 1, opacity: 1, zIndex: 5 },
  { x: '78%', y: '7%', rotate: '9deg', scale: 0.84, opacity: 0.55, zIndex: 2 },
  { x: '132%', y: '18%', rotate: '16deg', scale: 0.72, opacity: 0.28, zIndex: 1 },
]

const getCenteredSlots = (count) => {
  const visibleCount = Math.min(Math.max(count, 0), fanSlots.length)
  const centerOffset = Math.floor(visibleCount / 2)
  return fanSlots.slice(2 - centerOffset, 2 - centerOffset + visibleCount)
}

function RandomCoverFan({ covers = [], emptyLabel }) {
  const visibleCovers = useMemo(() => shuffleArray(Array.from(new Set(covers))).slice(0, fanSlots.length), [covers])

  if (!visibleCovers.length) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 lg:h-64">
        {emptyLabel}
      </div>
    )
  }

  const slots = getCenteredSlots(visibleCovers.length)

  return (
    <div className="relative h-60 w-full overflow-hidden sm:h-68 lg:h-76" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-white/85 to-transparent" />
      {visibleCovers.map((cover, index) => {
        const slot = slots[index]
        return (
          <div
            key={`${cover}-${index}`}
            className="absolute left-1/2 top-6 w-30 origin-bottom overflow-hidden rounded-md border border-white bg-slate-100 shadow-2xl shadow-slate-300/80 ring-1 ring-slate-900/10 transition duration-300 sm:w-36 lg:w-42"
            style={{
              opacity: slot.opacity,
              zIndex: slot.zIndex,
              transform: `translateX(calc(-50% + ${slot.x})) translateY(${slot.y}) rotate(${slot.rotate}) scale(${slot.scale})`,
            }}
          >
            <img src={cover} alt="" className="aspect-2/3 w-full object-cover" loading="lazy" />
          </div>
        )
      })}
    </div>
  )
}

export default RandomCoverFan
