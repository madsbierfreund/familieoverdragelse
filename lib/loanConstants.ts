/**
 * Standardværdier og grænser for finansieringen af datterens egenfinansiering.
 * Renter og satser angives som brøkdele pr. år, fx 0.0406 for 4,06%.
 */

/** Realkredit kan højst udgøre denne andel af belåningsgrundlaget. */
export const MORTGAGE_LTV_MAX = 0.8;

/** Långiveres sædvanlige krav til kontant udbetaling, andel af købesummen. */
export const MIN_DOWN_PAYMENT_SHARE = 0.05;

/** Debitorrente på realkreditlånet pr. år. */
export const DEFAULT_MORTGAGE_RATE = 0.0406;

/** Bidragssats pr. år. */
export const DEFAULT_CONTRIBUTION_RATE = 0.0057;

/** Kurs ved udbetaling af realkreditlånet. */
export const DEFAULT_BOND_PRICE = 98;

/** Løbetid på realkreditlånet i år. */
export const DEFAULT_MORTGAGE_YEARS = 30;

/** Årlig negativ nettokapitalindkomst med den høje fradragsværdi, enlig. */
export const TAX_DEDUCTION_THRESHOLD = 50_000;

/** Fradragsværdi op til grænsen. */
export const TAX_DEDUCTION_RATE_LOW = 0.33;

/** Fradragsværdi over grænsen. */
export const TAX_DEDUCTION_RATE_HIGH = 0.25;

/** Tilladt kursinterval. */
export const MIN_BOND_PRICE = 50;
export const MAX_BOND_PRICE = 105;

/** Tilladt løbetid i år. */
export const MIN_YEARS = 1;
export const MAX_YEARS = 30;
