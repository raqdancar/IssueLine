// Reusable loading placeholders for timeline views while backend data is in-flight.
import { cn } from '@/lib/utils'

const barClassesByVariant = {
  light: 'bg-slate-200',
  dark: 'bg-slate-700/80',
}

const panelClassesByVariant = {
  light: 'border-slate-200/90 bg-white/80',
  dark: 'border-slate-700/70 bg-slate-900/40',
}

function LoadingBar({ className, variant = 'light' }) {
  return <div className={cn('rounded-full', barClassesByVariant[variant], className)} />
}

export function TimelineLoadingSkeleton({ variant = 'light', showNavigator = true, cardCount = 5, className }) {
  return (
    <div className={cn('animate-pulse', className)} aria-hidden="true">
      <div className={cn('rounded-2xl border p-4', panelClassesByVariant[variant])}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <LoadingBar variant={variant} className="h-3 w-28" />
            <LoadingBar variant={variant} className="h-7 w-56 sm:w-72" />
          </div>
          <div className="space-y-2">
            <LoadingBar variant={variant} className="h-8 w-24" />
            <LoadingBar variant={variant} className="h-8 w-28" />
          </div>
        </div>

        <div
          className={cn(
            'mt-5 flex flex-col gap-4',
            showNavigator ? 'md:grid md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]' : '',
          )}
        >
          {showNavigator ? (
            <div className={cn('rounded-2xl border p-3', panelClassesByVariant[variant])}>
              <div className="space-y-2">
                <LoadingBar variant={variant} className="h-3 w-24" />
                <LoadingBar variant={variant} className="h-8 w-full" />
                <LoadingBar variant={variant} className="h-8 w-full" />
                <LoadingBar variant={variant} className="h-8 w-5/6" />
                <LoadingBar variant={variant} className="h-8 w-4/5" />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {Array.from({ length: cardCount }).map((_, index) => (
              <div key={`timeline-skeleton-card-${index}`} className={cn('rounded-2xl border p-3', panelClassesByVariant[variant])}>
                <div className="flex gap-3">
                  <div className={cn('h-20 w-14 shrink-0 rounded-lg', barClassesByVariant[variant])} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <LoadingBar variant={variant} className="h-3 w-2/3" />
                    <LoadingBar variant={variant} className="h-3 w-full" />
                    <LoadingBar variant={variant} className="h-3 w-5/6" />
                    <LoadingBar variant={variant} className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TimelineInsightsSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
          <div className="mx-auto h-28 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-1/2 rounded-full bg-slate-200" />
            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
          <div className="mx-auto h-28 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-1/2 rounded-full bg-slate-200" />
            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`insight-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="space-y-2">
              <div className="h-4 w-2/5 rounded-full bg-slate-200" />
              <div className="h-3 w-full rounded-full bg-slate-200" />
              <div className="h-3 w-4/5 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
