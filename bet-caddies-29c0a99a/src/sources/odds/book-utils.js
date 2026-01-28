export const BOOK_KEY_ALIASES = {
  dk: 'draftkings',
  draft_kings: 'draftkings',
  mgm: 'betmgm',
  caesars_sportsbook: 'caesars',
  bet_365: 'bet365',
  william_hill: 'williamhill',
  points_bet: 'pointsbet',
  barstool_sportsbook: 'barstool',
  bet_rivers: 'betrivers',
  bet_fair: 'betfair',
  sky_bet: 'skybet'
}

export const normalizeBookKey = (key) => {
  if (!key) return null
  const normalized = String(key).trim().toLowerCase().replace(/\u0000/g, '')
  const cleaned = normalized.replace(/\s+/g, '_')
  return BOOK_KEY_ALIASES[cleaned] || BOOK_KEY_ALIASES[normalized] || cleaned
}
