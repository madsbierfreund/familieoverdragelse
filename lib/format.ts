/** Afrunder til hele kroner og formaterer dansk (fx 6.700.400). */
export function fmt(value: number): string {
  return Math.round(value).toLocaleString('da-DK');
}

/** Formaterer et tal dansk med decimaler (fx 0,98). */
export function decimal(
  value: number,
  maxDecimals = 2,
  minDecimals = 0,
): string {
  return value.toLocaleString('da-DK', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/** Formaterer en rund brøkdel som procent, fx 0.8 til "80%". */
export function pct(fraction: number): string {
  return `${fraction * 100}%`;
}

/** Formaterer en rente med to decimaler, fx 0.0406 til "4,06%". */
export function ratePct(rate: number): string {
  return `${decimal(rate * 100, 2, 2)}%`;
}
