import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ArrowDown, ArrowUp, Minus, Calendar, Clock, Trophy, TrendingUp } from 'lucide-react'

const TOUR_LABELS = {
  PGA: 'PGA',
  DPWT: 'DPWT',
  KFT: 'KFT',
  LIV: 'LIV'
}

const STATUS_LABELS = {
  live: { label: 'LIVE', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
  upcoming: { label: 'UPCOMING', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
  in_progress_no_data: { label: 'IN PROGRESS', color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
  completed: { label: 'COMPLETED', color: 'bg-slate-500/20 text-slate-400 border-slate-500/50' }
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

const formatEdge = (value) => {
  if (!Number.isFinite(value)) return null
  return `${(value * 100).toFixed(1)}%`
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const MovementIndicator = ({ movement }) => {
  if (!movement) return <span className="text-slate-500">—</span>
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

const StatusBadge = ({ status, daysUntilStart }) => {
  const config = STATUS_LABELS[status] || STATUS_LABELS.upcoming
  return (
    <Badge className={`${config.color} border`}>
      {config.label}
      {status === 'upcoming' && daysUntilStart != null && (
        <span className="ml-1">({daysUntilStart}d)</span>
      )}
    </Badge>
  )
}

const TierBadge = ({ tier }) => {
  const colors = {
    BIRDIE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    EAGLE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    LONG_SHOTS: 'bg-purple-500/20 text-purple-400 border-purple-500/50'
  }
  return (
    <Badge className={`${colors[tier] || 'bg-slate-500/20 text-slate-400'} border text-xs`}>
      {tier?.replace('_', ' ') || 'N/A'}
    </Badge>
  )
}

const UpcomingEventCard = ({ event, rows }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-slate-300">
        <Calendar className="w-5 h-5 text-blue-400" />
        <span>Tournament starts {formatDate(event.startDate)}</span>
        {event.daysUntilStart != null && (
          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/50">
            {event.daysUntilStart === 0 ? 'Today' : 
             event.daysUntilStart === 1 ? 'Tomorrow' : 
             `${event.daysUntilStart} days`}
          </Badge>
        )}
      </div>
      
      <div className="text-sm text-slate-400 mb-4">
        Live scoring and odds movement will be available once the tournament begins.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-200">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className="py-3">Player</th>
              <th>Market</th>
              <th>Tier</th>
              <th>Odds</th>
              <th>Edge</th>
              <th>EV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.dgPlayerId || row.playerName}-${row.market}-${idx}`} className="border-b border-slate-800">
                <td className="py-3 font-medium text-white">{row.playerName}</td>
                <td className="uppercase text-xs text-slate-300">{row.market}</td>
                <td><TierBadge tier={row.tier} /></td>
                <td>
                  {row.baselineOddsDecimal ? (
                    <div className="flex flex-col">
                      <span>{row.baselineOddsDecimal.toFixed(2)}</span>
                      <span className="text-xs text-slate-500">{row.baselineBook || 'unknown'}</span>
                    </div>
                  ) : '—'}
                </td>
                <td className="text-emerald-400">{formatEdge(row.edge) || '—'}</td>
                <td className="text-emerald-400">{row.ev != null ? `${(row.ev * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const LiveEventTable = ({ rows, status }) => {
  const showLiveData = status === 'live'
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-200">
        <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
          <tr>
            <th className="py-3">Player</th>
            {showLiveData && (
              <>
                <th>Pos</th>
                <th>Score</th>
                <th>Today</th>
                <th>Thru</th>
              </>
            )}
            <th>Market</th>
            <th>Tier</th>
            <th>Baseline</th>
            {showLiveData && <th>Live Odds</th>}
            {showLiveData && <th>Move</th>}
            <th>Edge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.dgPlayerId || row.playerName}-${row.market}-${idx}`} className="border-b border-slate-800">
              <td className="py-3 font-medium text-white">{row.playerName}</td>
              {showLiveData && (
                <>
                  <td className={row.position != null && row.position <= 10 ? 'text-emerald-400 font-semibold' : ''}>
                    {row.position != null ? (row.position <= 1 ? '🏆 ' : '') + row.position : '—'}
                  </td>
                  <td>{row.totalToPar ?? '—'}</td>
                  <td>{row.todayToPar ?? '—'}</td>
                  <td>{row.thru ?? '—'}</td>
                </>
              )}
              <td className="uppercase text-xs text-slate-300">{row.market}</td>
              <td><TierBadge tier={row.tier} /></td>
              <td>
                {row.baselineOddsDecimal ? (
                  <div className="flex flex-col">
                    <span>{row.baselineOddsDecimal.toFixed(2)}</span>
                    <span className="text-xs text-slate-500">{row.baselineBook || 'unknown'}</span>
                  </div>
                ) : '—'}
              </td>
              {showLiveData && (
                <td>
                  {row.currentOddsDecimal ? (
                    <div className="flex flex-col">
                      <span>{row.currentOddsDecimal.toFixed(2)}</span>
                      <span className="text-xs text-slate-500">{row.currentBook || 'unknown'}</span>
                    </div>
                  ) : '—'}
                </td>
              )}
              {showLiveData && (
                <td>
                  <MovementIndicator movement={row.oddsMovement} />
                </td>
              )}
              <td className="text-emerald-400">{formatEdge(row.edge) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    refetchInterval: selectedEvent?.status === 'live' ? 60000 : 300000
  })

  const rows = eventResponse?.rows || []
  const eventStatus = eventResponse?.status || selectedEvent?.status || 'upcoming'
  const eventIssues = eventResponse?.dataIssues || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-white">Live Bet Tracking</h1>
        <p className="text-slate-400">
          Track BetCaddies recommended picks. View upcoming selections and live tournament positions.
        </p>
      </div>

      {activeLoading ? (
        <LoadingSpinner text="Loading tournaments..." />
      ) : activeEvents.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 text-center">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Tracked Events</h3>
          <p className="text-slate-400">
            There are no upcoming or live tournaments with bet recommendations right now.
            Check back after the next pipeline run on Tuesday morning.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {activeEvents.map((event) => (
              <Button
                key={`${event.tour}-${event.dgEventId}`}
                onClick={() => setSelectedEvent(event)}
                className={`border flex items-center gap-2 ${
                  selectedEvent?.dgEventId === event.dgEventId
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
                }`}
              >
                <span className="font-semibold">{TOUR_LABELS[event.tour] || event.tour}</span>
                <span>{event.eventName}</span>
                <StatusBadge status={event.status} daysUntilStart={event.daysUntilStart} />
                <Badge className="bg-slate-700/50 text-slate-200 border-slate-600/50">
                  {event.trackedCount} picks
                </Badge>
              </Button>
            ))}
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {selectedEvent?.eventName || 'Event Tracker'}
                    <StatusBadge 
                      status={eventStatus} 
                      daysUntilStart={eventResponse?.daysUntilStart ?? selectedEvent?.daysUntilStart} 
                    />
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {eventStatus === 'live' && (
                      <>Last updated: {eventResponse?.updatedAt ? new Date(eventResponse.updatedAt).toLocaleTimeString() : '—'}</>
                    )}
                    {eventStatus === 'upcoming' && eventResponse?.startDate && (
                      <>Starts: {formatDate(eventResponse.startDate)}</>
                    )}
                  </p>
                </div>
              </div>
              {eventStatus === 'live' && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Live updates every 60s</span>
                </div>
              )}
            </div>

            {eventLoading ? (
              <LoadingSpinner text="Loading tracker..." />
            ) : rows.length === 0 ? (
              <div className="text-slate-300 text-center py-8">
                <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p>No tracked picks for this event.</p>
              </div>
            ) : eventStatus === 'upcoming' ? (
              <UpcomingEventCard event={eventResponse || selectedEvent} rows={rows} />
            ) : (
              <LiveEventTable rows={rows} status={eventStatus} />
            )}

            {eventIssues.length > 0 && (
              <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300 mb-2 hover:text-slate-200">
                  Data issues ({eventIssues.length})
                </summary>
                <ul className="space-y-1 pl-4">
                  {eventIssues.slice(0, 10).map((issue, idx) => (
                    <li key={`${issue.step}-${idx}`} className="text-slate-500">
                      {issue.step}: {issue.message}
                    </li>
                  ))}
                  {eventIssues.length > 10 && (
                    <li className="text-slate-500">... and {eventIssues.length - 10} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>How it works:</strong> Bet recommendations are generated on Tuesday mornings. 
                Live scoring and odds movement tracking begins when tournaments start (typically Thursday). 
                Odds are pulled from allowed books (bet365, williamhill, skybet, unibet, betfair).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
