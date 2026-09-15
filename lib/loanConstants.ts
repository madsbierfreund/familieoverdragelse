/**
 * Standardværdier og grænser for finansieringen af datterens egenfinansiering.
 * Renter og satser angives som brøkdele pr. år, fx 0.0406 for 4,06%.
 */

/** Realkredit kan højst udgøre denne andel af belåningsgrundlaget. */
export const MORTGAGE_LTV_MAX = 0.8;

/** Långiveres sædvanlige krav til kontant udbetaling, andel af købesummen. */
export const MIN_DOWN_PAYMENT_SHARE = 0.05;

/** Afdragsfri periode i år på et lån med afdragsfrihed. */
export const INTEREST_ONLY_YEARS = 10;

/** De lånetyper, beregningen kan regne på. */
export type LoanType = 'fixed' | 'fixedInterestOnly' | 'flex';

export const LOAN_TYPES: Record<
  LoanType,
  {
    label: string;
    rate: number;
    contribution: number;
    bondPrice: number;
    interestOnlyYears: number;
  }
> = {
  fixed: {
    label: 'Fast rente med afdrag',
    rate: 0.0406,
    contribution: 0.0057,
    bondPrice: 98,
    interestOnlyYears: 0,
  },
  fixedInterestOnly: {
    label: `Fast rente, ${INTEREST_ONLY_YEARS} års afdragsfrihed`,
    rate: 0.0406,
    contribution: 0.0087,
    bondPrice: 98,
    interestOnlyYears: INTEREST_ONLY_YEARS,
  },
  flex: {
    label: 'Flexlån (F5) med afdrag',
    rate: 0.035,
    contribution: 0.0075,
    bondPrice: 100,
    interestOnlyYears: 0,
  },
};

export const DEFAULT_LOAN_TYPE: LoanType = 'fixed';

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
