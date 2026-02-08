export interface CandidateBet {
  playerId: string;
  market: string;
  edge: number;
}

export function optimisePortfolio(bets: CandidateBet[], maxPerPlayer = 2, maxTotal = 5): CandidateBet[] {
  const byPlayer: Record<string, CandidateBet[]> = {};
  bets.forEach(b => {
    byPlayer[b.playerId] = byPlayer[b.playerId] || [];
    byPlayer[b.playerId].push(b);
  });

  const filtered: CandidateBet[] = [];
  Object.values(byPlayer).forEach(playerBets => {
    playerBets
      .sort((a, b) => b.edge - a.edge)
      .slice(0, maxPerPlayer)
      .forEach(b => filtered.push(b));
  });

  return filtered
    .sort((a, b) => b.edge - a.edge)
    .slice(0, maxTotal);
}
