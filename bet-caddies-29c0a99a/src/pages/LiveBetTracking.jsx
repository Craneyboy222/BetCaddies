import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

const TOUR_LABELS = {
  PGA: 'PGA',
  DPWT: 'DPWT',
  KFT: 'KFT',
  LIV: 'LIV'
}

const formatPct = (value) => {
  if (!Number.isFinite(value)) return null
  return `${(value * 100).toFixed(1)}%`
}

const formatDelta = (value) => {
  if (!Number.isFinite(value)) return null
  const sign = value > 0 ? '+' : value < 0 ? '' : ''
  return `${sign}${value.toFixed(2)}`
}

const MovementIndicator = ({ movement }) => {
  if (!movement) return <span className="text-slate-500">Unavailable</span>
  const direction = movement.direction
  const pct = formatPct(movement.pctChange)
  const delta = formatDelta(movement.deltaDecimal)
  const crossBook = movement.crossBook

  if (direction === 'UP') {
    return (
      <div className="flex items-center gap-1 text-emerald-400">
        <ArrowUp className="w-4 h-4" />
        <span>{delta}</span>
        {pct ? <span>({pct})</span> : null}
        {crossBook ? <span className="text-xs text-slate-400">cross-book</span> : null}
      </div>
    )
  }

  if (direction === 'DOWN') {
    return (
      <div className="flex items-center gap-1 text-rose-400">
        <ArrowDown className="w-4 h-4" />
        <span>{delta}</span>
        {pct ? <span>({pct})</span> : null}
        {crossBook ? <span className="text-xs text-slate-400">cross-book</span> : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-slate-400">
      <Minus className="w-4 h-4" />
      <span>{delta || '0.00'}</span>
      {pct ? <span>({pct})</span> : null}
      {crossBook ? <span className="text-xs text-slate-400">cross-book</span> : null}
    </div>
  )
}

export default function LiveBetTracking() {
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { data: activeResponse, isLoading: activeLoading } = useQuery({
    queryKey: ['liveTrackingActive'],
    queryFn: () => api.liveTracking.active(),
    refetchInterval: 60000
  })

  const activeEvents = useMemo(() => {
    if (Array.isArray(activeResponse)) return activeResponse
    return activeResponse?.data || []
  }, [activeResponse])

  React.useEffect(() => {
    if (!selectedEvent && activeEvents.length) {
      setSelectedEvent(activeEvents[0])
    }
  }, [activeEvents, selectedEvent])

  const { data: eventResponse, isLoading: eventLoading } = useQuery({
    queryKey: ['liveTrackingEvent', selectedEvent?.dgEventId, selectedEvent?.tour],
    enabled: Boolean(selectedEvent?.dgEventId && selectedEvent?.tour),
    queryFn: () => api.liveTracking.event(selectedEvent.dgEventId, selectedEvent.tour),
    refetchInterval: 60000
  })

  const rows = eventResponse?.rows || []
  const eventIssues = eventResponse?.dataIssues || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-white">Live Bet Tracking</h1>
        <p className="text-slate-400">
          Track BetCaddies recommended picks in real time. Odds use allowed books only and movement is
          measured against recommendation-time odds (or first live snapshot if missing).
        </p>
      </div>

      {activeLoading ? (
        <LoadingSpinner text="Loading active tournaments..." />
      ) : activeEvents.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 text-slate-300">
          No in-play tournaments right now.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {activeEvents.map((event) => (
              <Button
                key={`${event.tour}-${event.dgEventId}`}
                onClick={() => setSelectedEvent(event)}
                className={`border ${
                  selectedEvent?.dgEventId === event.dgEventId
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
                }`}
              >
                <span className="mr-2 font-semibold">{TOUR_LABELS[event.tour] || event.tour}</span>
                <span>{event.eventName}</span>
                <Badge className="ml-2 bg-slate-700/50 text-slate-200 border-slate-600/50">
                  {event.trackedCount} picks
                </Badge>
              </Button>
            ))}
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {selectedEvent?.eventName || 'Event Tracker'}
                </h2>
                <p className="text-slate-400 text-sm">
                  Last updated: {eventResponse?.updatedAt || '—'}
                </p>
              </div>
            </div>

            {eventLoading ? (
              <LoadingSpinner text="Loading live tracker..." />
            ) : rows.length === 0 ? (
              <div className="text-slate-300">No tracked picks for this event.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-200">
                  <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-3">Player</th>
                      <th>Pos</th>
                      <th>Score</th>
                      <th>Today</th>
                      <th>Thru</th>
                      <th>Market</th>
                      <th>Baseline</th>
                      <th>Live Odds</th>
                      <th>Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.dgPlayerId || row.playerName}-${row.market}`} className="border-b border-slate-800">
                        <td className="py-3 font-medium text-white">{row.playerName}</td>
                        <td>{row.position ?? '—'}</td>
                        <td>{row.totalToPar ?? '—'}</td>
                        <td>{row.todayToPar ?? '—'}</td>
                        <td>{row.thru ?? '—'}</td>
                        <td className="uppercase text-xs text-slate-300">{row.market}</td>
                        <td>
                          {row.baselineOddsDecimal ? (
                            <div className="flex flex-col">
                              <span>{row.baselineOddsDecimal.toFixed(2)}</span>
                              <span className="text-xs text-slate-500">{row.baselineBook || 'unknown'}</span>
                            </div>
                          ) : (
                            'Unavailable'
                          )}
                        </td>
                        <td>
                          {row.currentOddsDecimal ? (
                            <div className="flex flex-col">
                              <span>{row.currentOddsDecimal.toFixed(2)}</span>
                              <span className="text-xs text-slate-500">{row.currentBook || 'unknown'}</span>
                            </div>
                          ) : (
                            'Unavailable'
                          )}
                        </td>
                        <td>
                          <MovementIndicator movement={row.oddsMovement} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {eventIssues.length > 0 && (
              <div className="mt-4 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 mb-2">Data issues</div>
                <ul className="space-y-1">
                  {eventIssues.map((issue, idx) => (
                    <li key={`${issue.step}-${idx}`}>
                      {issue.step}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400">
            Odds are pulled from allowed books only (bet365, williamhill, skybet, unibet, betfair). Movement is
            based on recommendation-time odds when available, otherwise the first live snapshot. Missing live
            feeds are shown as unavailable and logged as data issues.
          </div>
        </div>
      )}
    </div>
  )
}
