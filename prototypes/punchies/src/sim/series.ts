export interface SeriesState {
  bestOf: 1 | 3;
  roundNumber: number;
  wins: [number, number];
}

export function newSeries(bestOf: number): SeriesState {
  return { bestOf: bestOf === 1 ? 1 : 3, roundNumber: 1, wins: [0, 0] };
}

export function finishRound(series: SeriesState, winner: number | null): { series: SeriesState; complete: boolean } {
  const wins: [number, number] = [...series.wins];
  if (winner === 0 || winner === 1) wins[winner]++;
  const complete = series.bestOf === 1 || wins.some((n) => n >= 2);
  return { series: { ...series, wins, roundNumber: series.roundNumber + (complete ? 0 : 1) }, complete };
}
