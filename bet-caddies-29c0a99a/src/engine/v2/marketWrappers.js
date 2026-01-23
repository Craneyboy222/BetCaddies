export const matchupProbability = (playerA, playerB, sims = []) => {
  let wins = 0
  for (const sim of sims) {
    const a = sim[playerA]
    const b = sim[playerB]
    if (a == null || b == null) continue
    if (a < b) wins += 1
    if (a === b) wins += 0.5
  }
  return sims.length > 0 ? wins / sims.length : null
}

export const threeBallProbability = (playerA, playerB, playerC, sims = []) => {
  let wins = 0
  for (const sim of sims) {
    const a = sim[playerA]
    const b = sim[playerB]
    const c = sim[playerC]
    if (a == null || b == null || c == null) continue
    if (a < b && a < c) wins += 1
    if (a === b && a < c) wins += 0.5
    if (a === c && a < b) wins += 0.5
    if (a === b && a === c) wins += 1 / 3
  }
  return sims.length > 0 ? wins / sims.length : null
}
