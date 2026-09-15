/** Afrunder til hele kroner og formaterer dansk (fx 6.700.400). */
export function fmt(value: number): string {
  return Math.round(value).toLocaleString('da-DK');
}
