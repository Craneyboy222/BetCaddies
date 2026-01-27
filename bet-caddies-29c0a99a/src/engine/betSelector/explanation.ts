export interface ExplanationInput {
  playerName: string;
  market: string;
  reasons: string[]; // plain-English sentences
  stats: string[];   // key stats / data points
}

export interface BetExplanation {
  paragraph: string;
  bullets: string[];
}

export function generateExplanation(input: ExplanationInput): BetExplanation {
  const paragraph = `We like ${input.playerName} in the ${input.market} market this week. ` +
    `Overall, the data points to a player whose strengths line up nicely with the test on offer. ` +
    `This isn’t about chasing hype — it’s about steady indicators that suggest ${input.playerName} ` +
    `is well placed to deliver a solid performance if things play out as expected.`;

  const bullets = input.stats.map(stat => `• ${stat}`);

  return { paragraph, bullets };
}
