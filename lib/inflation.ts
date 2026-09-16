/**
 * Omregner et fremtidigt beløb til dagens kroner.
 * Ren funktion uden afhængigheder til UI.
 */
export function toTodaysValue(
  amount: number,
  rate: number,
  years: number,
): number {
  return amount / Math.pow(1 + rate, years);
}
