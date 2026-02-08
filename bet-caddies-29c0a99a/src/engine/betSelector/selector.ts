import { CandidateBet } from '../portfolioOptimizer/optimizer';

export type BetTier = 'Par' | 'Birdie' | 'Eagle' | 'Long Shot';

export interface TieredBet extends CandidateBet {
  tier: BetTier;
}

export function assignTier(bet: CandidateBet): BetTier {
  if (bet.edge > 0.08) return 'Par';
  if (bet.edge > 0.05) return 'Birdie';
  if (bet.edge > 0.03) return 'Eagle';
  return 'Long Shot';
}

export function selectBets(bets: CandidateBet[]): TieredBet[] {
  return bets.map(b => ({ ...b, tier: assignTier(b) }));
}
