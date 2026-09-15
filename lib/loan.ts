import { PURCHASE_PRICE } from './constants';
import {
  MIN_DOWN_PAYMENT_SHARE,
  MORTGAGE_LTV_MAX,
  TAX_DEDUCTION_RATE_HIGH,
  TAX_DEDUCTION_RATE_LOW,
  TAX_DEDUCTION_THRESHOLD,
} from './loanConstants';

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
  /** Renter af realkreditlånet i det første år. */
  firstYearInterest: number;
  /** Bidrag i det første år. */
  firstYearContribution: number;
  /** Fradragsberettiget beløb i det første år. */
  deductible: number;
  /** Anslået skatteværdi af fradraget pr. år. */
  taxSavingYear: number;
  /** Anslået skatteværdi af fradraget pr. måned. */
  taxSavingMonthly: number;
  /** Månedlig ydelse efter skat. */
  monthlyAfterTax: number;
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
 * Renterne i de første tolv ydelser, måned for måned på den faldende restgæld.
 */
function firstYearInterestOf(
  principal: number,
  annualRate: number,
  years: number,
  payment: number,
): number {
  const rate = annualRate / 12;
  const months = Math.min(12, years * 12);

  let balance = principal;
  let interest = 0;
  for (let month = 0; month < months; month++) {
    const monthInterest = balance * rate;
    interest += monthInterest;
    balance -= payment - monthInterest;
  }
  return interest;
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

  // Renter og bidrag er fradragsberettigede, afdraget er ikke.
  const firstYearInterest = firstYearInterestOf(
    mortgagePrincipal,
    mortgageRate,
    mortgageYears,
    mortgagePayment,
  );
  const firstYearContribution = mortgageContribution * 12;
  const deductible = firstYearInterest + firstYearContribution;
  const taxSavingYear =
    Math.min(deductible, TAX_DEDUCTION_THRESHOLD) * TAX_DEDUCTION_RATE_LOW +
    Math.max(0, deductible - TAX_DEDUCTION_THRESHOLD) * TAX_DEDUCTION_RATE_HIGH;
  const taxSavingMonthly = taxSavingYear / 12;

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
    firstYearInterest,
    firstYearContribution,
    deductible,
    taxSavingYear,
    taxSavingMonthly,
    monthlyAfterTax: mortgageMonthly - taxSavingMonthly,
    totalDebt: mortgagePrincipal,
  };
}
