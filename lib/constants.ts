/**
 * Faste forudsætninger for familieoverdragelsen.
 * Alle beløb er i danske kroner.
 */

/** Offentlig ejendomsvurdering 2020 for hele ejendommen. */
export const PUBLIC_VALUATION = 16_751_000;

/** Anpart A udgør 50/100 af ejendommen. */
export const SHARE_FRACTION = 0.5;

/** 20%-reglen: laveste tilladte pris er 80% af vurderingen. */
export const PRICE_FACTOR = 0.8;

/** Købesummen for anpart A efter 20%-reglen. */
export const PURCHASE_PRICE = PUBLIC_VALUATION * SHARE_FRACTION * PRICE_FACTOR;

/** Afgiftsfrit gavebeløb pr. år. */
export const ANNUAL_GIFT_ALLOWANCE = 80_600;

/** Antal år med eftergivelse på gældsbrevet. */
export const GIFT_YEARS = 5;

/** Samlet eftergivelse over gaveårene. */
export const MAX_FORGIVEN = ANNUAL_GIFT_ALLOWANCE * GIFT_YEARS;

/** Antal børn (arvinger). */
export const CHILDREN = 5;

/** Datterens søskende, altså alle børn på nær hende selv. */
export const SIBLINGS = CHILDREN - 1;
