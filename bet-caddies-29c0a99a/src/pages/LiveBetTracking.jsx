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

const formatProb = (value) => {
  if (value == null || !Number.isFinite(value)) return null
  return `${(value * 100).toFixed(1)}%`
}

const getProbColor = (prob) => {
  if (prob == null) return 'text-slate-500'
  if (prob >= 0.5) return 'text-emerald-400'
  if (prob >= 0.25) return 'text-emerald-300'
  if (prob >= 0.1) return 'text-amber-400'
  return 'text-slate-400'
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const MovementIndicator = ({ movement }) => {
  if (!movement) return <span className="text-slate-500">—</span>
  const direction = movement.direction
  const delta = formatDelta(movement.deltaDecimal)

  if (direction === 'DOWN') {
    return (
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-1 font-semibold text-emerald-400">
          <ArrowDown className="w-4 h-4" />
          <span>{delta}</span>
        </div>
        <span className="text-xs text-emerald-400/80">✓ Looking good</span>
      </div>
    )
  }

  if (direction === 'UP') {
    return (
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-1 font-semibold text-rose-400">
          <ArrowUp className="w-4 h-4" />
          <span>{delta}</span>
        </div>
        <span className="text-xs text-rose-400/80">Drifting</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1 text-slate-400">
        <Minus className="w-4 h-4" />
        <span>{delta || '0.00'}</span>
      </div>
      <span className="text-xs text-slate-500">No change</span>
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

const BetOutcomeBadge = ({ outcome, playerStatus }) => {
  if (outcome === 'won') {
    return (
      <Badge className="bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-semibold animate-pulse">
        🏆 WON
      </Badge>
    )
  }
  if (outcome === 'lost') {
    return (
      <Badge className="bg-red-500/20 text-red-400 border border-red-500/50">
        ✗ Lost
      </Badge>
    )
  }
  if (playerStatus === 'MC') {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/50">
        MC
      </Badge>
    )
  }
  if (playerStatus === 'WD') {
    return (
      <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/50">
        WD
      </Badge>
    )
  }
  if (playerStatus === 'DQ') {
    return (
      <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/50">
        DQ
      </Badge>
    )
  }
  // Pending
  return (
    <span className="text-slate-500 text-xs">In Play</span>
  )
}

const ProbabilityCell = ({ row }) => {
  const mProb = row.marketProb
  const wProb = row.winProb
  const label = row.marketProbLabel

  if (mProb == null && wProb == null) return <span className="text-slate-600">—</span>

  return (
    <div className="flex flex-col items-start gap-0.5">
      {mProb != null && (
        <div className={`font-semibold ${getProbColor(mProb)}`}>
          {formatProb(mProb)}
          <span className="text-[10px] text-slate-500 ml-1">{label}</span>
        </div>
      )}
      {wProb != null && mProb !== wProb && (
        <div className="text-[10px] text-slate-500">
          {formatProb(wProb)} win
        </div>
      )}
    </div>
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
              <th>Our Pick Odds</th>
              <th>Edge</th>
              <th>Expected Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.dgPlayerId || row.playerName}-${row.market}-${idx}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-3 font-medium text-white">{row.playerName}</td>
                <td className="uppercase text-xs text-slate-300">{row.market}</td>
                <td><TierBadge tier={row.tier} /></td>
                <td>
                  {row.baselineOddsDecimal ? (
                    <div className="flex flex-col">
                      <span className="font-mono">{row.baselineOddsDecimal.toFixed(2)}</span>
                      <span className="text-xs text-slate-500">{row.baselineBook || ''}</span>
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

// Helper to format round score (show relative to par or actual strokes)
const RoundScore = ({ score }) => {
  if (score == null) return <span className="text-slate-600">—</span>
  return <span>{score}</span>
}

const LiveEventTable = ({ rows, status }) => {
  // Separate active bets from definitively lost bets
  // A bet is definitively lost if the player missed the cut (or WD/DQ) and the bet requires placement
  const isDefinitelyLost = (row) => {
    if (row.betOutcome === 'lost') return true
    const playerStatus = row.playerStatus
    if (!playerStatus) return false
    
    // Player eliminated (MC, WD, DQ)
    const isEliminated = playerStatus === 'MC' || playerStatus === 'WD' || playerStatus === 'DQ'
    if (!isEliminated) return false
    
    // Check if the market requires the player to place/finish (not miss cut market)
    const market = (row.market || '').toLowerCase()
    const placementMarkets = ['win', 'top_5', 'top_10', 'top_20', 'top5', 'top10', 'top20', 'make_cut', 'frl']
    return placementMarkets.some(m => market.includes(m))
  }
  
  const activeBets = rows.filter(r => !isDefinitelyLost(r))
  const eliminatedBets = rows.filter(r => isDefinitelyLost(r))
  
  // Calculate results summary from active bets only
  const wins = rows.filter(r => r.betOutcome === 'won')
  const losses = eliminatedBets
  const pending = activeBets.filter(r => r.betOutcome === 'pending' || !r.betOutcome)
  
  return (
    <div className="overflow-x-auto">
      {/* Results Summary */}
      {(wins.length > 0 || losses.length > 0) && (
        <div className="mb-4 p-4 bg-gradient-to-r from-emerald-900/30 to-slate-800/50 rounded-lg border border-emerald-500/30">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-2xl font-bold">{wins.length}</span>
              <span className="text-emerald-300 font-medium">🏆 Wins</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-2xl font-bold">{losses.length}</span>
              <span className="text-red-300 font-medium">Losses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-2xl font-bold">{pending.length}</span>
              <span className="text-slate-300 font-medium">In Play</span>
            </div>
          </div>
          {wins.length > 0 && (
            <div className="mt-3 text-sm text-emerald-300">
              <span className="font-semibold">Winners:</span>{' '}
              {wins.map((w, i) => (
                <span key={i}>
                  {w.playerName} ({w.market.toUpperCase()})
                  {i < wins.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Legend for non-bettors */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400">
        <span className="font-semibold text-white">Quick Guide:</span>{' '}
        <span className="text-emerald-400">↓ Green = Good</span> (odds dropped, your pick is doing well) •{' '}
        <span className="text-rose-400">↑ Red = Drifting</span> (odds rising, player losing ground) •{' '}
        <span className="text-emerald-300">🏆 WON = Bet Settled</span>
      </div>
      
      {activeBets.length === 0 && eliminatedBets.length > 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-lg">All bets for this event have been settled.</p>
          <p className="text-sm mt-2">Check the eliminated bets below for the final results.</p>
        </div>
      ) : (
      <table className="w-full text-sm text-left text-slate-200">
        <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
          <tr>
            <th className="py-3 sticky left-0 bg-slate-900">Player</th>
            <th>Pos</th>
            <th>Total</th>
            <th className="text-center" colSpan="4">Round Scores</th>
            <th>Today</th>
            <th>Thru</th>
            <th>Market</th>
            <th>Tier</th>
            <th>Our Pick</th>
            <th>Now</th>
            <th>Movement</th>
            <th>Result</th>
            <th>Model Prob</th>
            <th>Edge</th>
          </tr>
          <tr className="text-[10px] text-slate-500">
            <th className="sticky left-0 bg-slate-900"></th>
            <th></th>
            <th></th>
            <th>R1</th>
            <th>R2</th>
            <th>R3</th>
            <th>R4</th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th className="text-slate-500 font-normal">When we picked</th>
            <th className="text-slate-500 font-normal">Current</th>
            <th></th>
            <th></th>
            <th className="text-slate-500 font-normal">Live DG</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {activeBets.map((row, idx) => {
            const isWin = row.betOutcome === 'won'
            const oddsReduced = row.oddsMovement?.direction === 'DOWN'
            const rowClass = isWin
              ? 'border-b border-emerald-500/50 bg-emerald-500/10'
              : oddsReduced
              ? 'border-b border-emerald-500/30 bg-emerald-500/5'
              : 'border-b border-slate-800 hover:bg-slate-800/50'
            return (
            <tr key={`${row.dgPlayerId || row.playerName}-${row.market}-${idx}`} className={rowClass}>
              <td className={`py-3 font-medium sticky left-0 ${isWin ? 'text-emerald-300 bg-emerald-500/10' : oddsReduced ? 'text-emerald-200 bg-emerald-500/5' : 'text-white bg-slate-900'}`}>
                {isWin && '🏆 '}{row.playerName}
              </td>
              <td className={row.position != null && row.position <= 10 ? 'text-emerald-400 font-bold' : ''}>
                {row.playerStatus === 'MC' ? (
                  <span className="text-amber-400 font-semibold">MC</span>
                ) : row.playerStatus === 'WD' ? (
                  <span className="text-slate-400">WD</span>
                ) : row.playerStatus === 'DQ' ? (
                  <span className="text-slate-400">DQ</span>
                ) : row.position != null ? (
                  (row.position <= 1 ? '🏆 ' : '') + row.position
                ) : '—'}
              </td>
              <td className="font-semibold">{row.totalToPar ?? '—'}</td>
              <td className="text-slate-400"><RoundScore score={row.r1} /></td>
              <td className="text-slate-400"><RoundScore score={row.r2} /></td>
              <td className="text-slate-400"><RoundScore score={row.r3} /></td>
              <td className="text-slate-400"><RoundScore score={row.r4} /></td>
              <td>{row.todayToPar ?? '—'}</td>
              <td className="text-slate-400">{row.thru ?? '—'}</td>
              <td className="uppercase text-xs text-slate-300">{row.market}</td>
              <td><TierBadge tier={row.tier} /></td>
              <td>
                {row.baselineOddsDecimal ? (
                  <div className="flex flex-col">
                    <span className="font-mono">{row.baselineOddsDecimal.toFixed(2)}</span>
                    <span className="text-xs text-slate-500">{row.baselineBook || ''}</span>
                  </div>
                ) : '—'}
              </td>
              <td>
                {row.currentOddsDecimal ? (
                  <div className="flex flex-col">
                    <span className="font-mono">{row.currentOddsDecimal.toFixed(2)}</span>
                    <span className="text-xs text-slate-500">{row.currentBook || ''}</span>
                  </div>
                ) : '—'}
              </td>
              <td>
                <MovementIndicator movement={row.oddsMovement} />
              </td>
              <td>
                <BetOutcomeBadge outcome={row.betOutcome} playerStatus={row.playerStatus} />
              </td>
              <td>
                <ProbabilityCell row={row} />
              </td>
              <td className="text-emerald-400">{formatEdge(row.edge) || '—'}</td>
            </tr>
          )})}
        </tbody>
      </table>
      )}
      
      {/* Eliminated Bets - Collapsed Section */}
      {eliminatedBets.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-400 text-sm font-medium flex items-center gap-2">
            <span className="text-red-400">✗</span>
            Eliminated ({eliminatedBets.length} bets lost - MC/WD/DQ)
          </summary>
          <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {eliminatedBets.map((row, idx) => (
              <div 
                key={`eliminated-${row.dgPlayerId || row.playerName}-${row.market}-${idx}`}
                className="bg-slate-800/20 rounded-lg border border-red-500/20 p-3 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-400">{row.playerName}</span>
                    <span className="text-red-400 text-xs ml-2">{row.playerStatus}</span>
                  </div>
                  <span className="text-slate-500 text-xs">@ {row.baselineOddsDecimal?.toFixed(2) || '—'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {row.market?.toUpperCase()} • Lost
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export default function LiveBetTracking() {
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { data: activeResponse, isLoading: activeLoading } = useQuery({
    queryKey: ['liveTrackingActive'],
    queryFn: () => api.liveTracking.active(),
    refetchInterval: 300000
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
    refetchInterval: selectedEvent?.status === 'live' ? 300000 : 600000
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
