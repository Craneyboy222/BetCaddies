export interface EdgeResult {
  edge: number;
  modelProb: number;
  bookProb: number;
}

export function calculateEdge(modelProb: number, odds: number): EdgeResult {
  const bookProb = 1 / odds;
  return {
    modelProb,
    bookProb,
    edge: modelProb - bookProb
  };
}
