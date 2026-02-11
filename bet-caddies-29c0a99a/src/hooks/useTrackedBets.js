import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'betcaddies_tracked_bets';

function loadTracked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTracked(tracked) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Hook for tracking bets via localStorage.
 * Returns { trackedIds, isTracked, toggleTrack, trackedBets, clearAll }
 */
export function useTrackedBets() {
  const [tracked, setTracked] = useState(loadTracked);

  // Sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) setTracked(loadTracked());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const isTracked = useCallback((betId) => !!tracked[betId], [tracked]);

  const toggleTrack = useCallback((bet) => {
    setTracked(prev => {
      const next = { ...prev };
      if (next[bet.id]) {
        delete next[bet.id];
      } else {
        next[bet.id] = {
          id: bet.id,
          selection_name: bet.selection_name,
          market_label: bet.market_label,
          tour: bet.tour,
          tournament_name: bet.tournament_name,
          odds_display_best: bet.odds_display_best,
          odds_decimal_best: bet.odds_decimal_best,
          edge_pct: bet.edge_pct,
          fair_prob_pct: bet.fair_prob_pct,
          provider_best_slug: bet.provider_best_slug,
          category: bet.category,
          tier: bet.tier,
          is_matchup: bet.is_matchup,
          matchup_opponent: bet.matchup_opponent,
          confidence_rating: bet.confidence_rating,
          tracked_at: new Date().toISOString()
        };
      }
      saveTracked(next);
      return next;
    });
  }, []);

  const trackedBets = Object.values(tracked).sort(
    (a, b) => new Date(b.tracked_at) - new Date(a.tracked_at)
  );

  const clearAll = useCallback(() => {
    setTracked({});
    saveTracked({});
  }, []);

  return { isTracked, toggleTrack, trackedBets, clearAll };
}
