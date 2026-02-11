export const matchupProbability = (playerA, playerB, sims = []) => {
  let wins = 0
  let counted = 0
  for (const sim of sims) {
    const a = sim[playerA]
    const b = sim[playerB]
    if (a == null || b == null) continue
    counted += 1
    if (a < b) wins += 1
    if (a === b) wins += 0.5
  }
  return counted > 0 ? wins / counted : null
}

export const threeBallProbability = (playerA, playerB, playerC, sims = []) => {
  let wins = 0
  let counted = 0
  for (const sim of sims) {
    const a = sim[playerA]
    const b = sim[playerB]
    const c = sim[playerC]
    if (a == null || b == null || c == null) continue
    counted += 1
    if (a < b && a < c) wins += 1
    if (a === b && a < c) wins += 0.5
    if (a === c && a < b) wins += 0.5
    if (a === b && a === c) wins += 1 / 3
  }
  return counted > 0 ? wins / counted : null
}
