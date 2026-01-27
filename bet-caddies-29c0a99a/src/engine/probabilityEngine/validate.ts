export function validateProbabilities(players: any[]) {
  const sum = players.reduce((acc, p) => acc + (p.win_prob || 0), 0);
  if (sum < 0.95 || sum > 1.05) {
    throw new Error('Win probabilities do not sum to ~1');
  }
}
