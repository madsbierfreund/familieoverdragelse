import { PURCHASE_PRICE } from './constants';
import { MIN_DOWN_PAYMENT_SHARE, MORTGAGE_LTV_MAX } from './loanConstants';

/** Grundlaget for belåningen: markedsværdien eller købesummen. */
export type LendingBasis = 'market' | 'purchase';

export interface LoanInput {
  /** Ejendommens markedsværdi, delt med arveberegneren. */
  marketValue: number;
  /** Datterens egenfinansiering, delt med arveberegneren. */
  ownFinancing: number;
  lendingBasis: LendingBasis;
  /** Kontant udbetaling. */
  downPayment: number;
  /** Debitorrente på realkreditlånet pr. år. */
  mortgageRate: number;
  /** Bidragssats pr. år. */
  contributionRate: number;
  /** Kurs ved udbetaling. */
  bondPrice: number;
  /** Løbetid på realkreditlånet i år. */
  mortgageYears: number;
}

export interface LoanResult {
  /** Belåningsgrundlaget. */
  basis: number;
  /** Største udbetalte realkreditlån. */
  maxMortgageCash: number;
  /** Det beløb, der skal lånes ud over udbetalingen. */
  toFinance: number;
  /** Udbetalt realkreditlån. */
  mortgageCash: number;
  /** Realkreditlånets hovedstol. */
  mortgagePrincipal: number;
  /** Hvor meget udbetalingen mangler i forhold til långiveres krav. */
  downPaymentShortfall: number;
  /** Mindste udbetaling, hvis realkredit skal dække resten. */
  minDownPaymentForLtv: number;
  /** Månedlig rente og afdrag på realkreditlånet. */
  mortgagePayment: number;
  /** Månedligt bidrag, første år. */
  mortgageContribution: number;
  /** Samlet månedlig ydelse på realkreditlånet. */
  mortgageMonthly: number;
  /** Samlet månedlig ydelse. */
  totalMonthly: number;
  /** Samlet gæld. */
  totalDebt: number;
}

/**
 * Månedlig annuitetsydelse på et lån.
 * Ren funktion uden afhængigheder til UI.
 */
export function annuity(
  principal: number,
  annualRate: number,
  years: number,
): number {
  if (principal === 0) return 0;

  const rate = annualRate / 12;
  const months = years * 12;

  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
}

/**
 * Fordeler egenfinansieringen på kontant udbetaling og realkreditlån
 * og beregner den månedlige ydelse i det første år.
 * Ren funktion uden afhængigheder til UI.
 */
export function calculateLoan(input: LoanInput): LoanResult {
  const {
    marketValue,
    ownFinancing,
    lendingBasis,
    downPayment,
    mortgageRate,
    contributionRate,
    bondPrice,
    mortgageYears,
  } = input;

  const basis =
    lendingBasis === 'market'
      ? Math.max(marketValue, PURCHASE_PRICE)
      : PURCHASE_PRICE;

  const maxMortgageCash = MORTGAGE_LTV_MAX * basis;
  const toFinance = ownFinancing - downPayment;
  const mortgageCash = toFinance;
  const mortgagePrincipal = mortgageCash / (bondPrice / 100);

  const downPaymentShortfall = Math.max(
    0,
    MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE - downPayment,
  );
  const minDownPaymentForLtv = Math.max(0, ownFinancing - maxMortgageCash);

  const mortgagePayment = annuity(
    mortgagePrincipal,
    mortgageRate,
    mortgageYears,
  );
  // Bidraget beregnes af hovedstolen og gælder derfor kun det første år.
  const mortgageContribution = (mortgagePrincipal * contributionRate) / 12;
  const mortgageMonthly = mortgagePayment + mortgageContribution;

  return {
    basis,
    maxMortgageCash,
    toFinance,
    mortgageCash,
    mortgagePrincipal,
    downPaymentShortfall,
    minDownPaymentForLtv,
    mortgagePayment,
    mortgageContribution,
    mortgageMonthly,
    totalMonthly: mortgageMonthly,
    totalDebt: mortgagePrincipal,
  };
}
