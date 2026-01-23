export const buildCourseProfile = ({ event, historicalRounds = [] } = {}) => {
  const scores = historicalRounds
    .map((row) => Number(row.total_score || row.score || row.total))
    .filter(Number.isFinite)

  const mean = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0

  const variance = scores.length > 0
    ? scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length
    : 4

  return {
    eventId: event?.id || null,
    mean,
    variance
  }
}
