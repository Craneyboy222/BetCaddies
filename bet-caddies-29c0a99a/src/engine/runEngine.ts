import { BETC_OPTIMAL_ENGINE_ENABLED } from './featureFlags';

// Legacy engine placeholder
export async function runLegacyEngine(input: any) {
  return { source: 'legacy', bets: [] };
}

// Optimal engine placeholder
export async function runOptimalEngine(input: any) {
  return { source: 'optimal', bets: [] };
}

export async function runEngine(input: any) {
  const legacy = await runLegacyEngine(input);
  if (!BETC_OPTIMAL_ENGINE_ENABLED) {
    return legacy;
  }

  const optimal = await runOptimalEngine(input);

  // Parallel run comparison (silent)
  return {
    active: optimal,
    comparison: {
      legacy,
      optimal
    }
  };
}
