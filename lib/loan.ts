import { PURCHASE_PRICE } from './constants';
import {
  LOAN_TYPES,
  type LoanType,
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
  /** Lånetypen, som bestemmer en eventuel afdragsfri periode. */
  loanType: LoanType;
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

/** En afdragsplan, der kan svare på ydelse, restgæld og renter. */
export interface Schedule {
  /** Ydelsen i en given måned, 1-indekseret. 0 efter sidste termin. */
  paymentInMonth(month: number): number;
  /** Restgælden efter et antal måneder. 0 når lånet er betalt ud. */
  balanceAfter(months: number): number;
  /** Renterne i de første måneder. */
  interestInFirst(months: number): number;
}

/**
 * Afdragsplanen for et annuitetslån med en eventuel afdragsfri periode.
 * I den afdragsfri periode betales kun renten, så restgælden står stille.
 * Ren funktion uden afhængigheder til UI.
 */
export function schedule(
  principal: number,
  annualRate: number,
  years: number,
  interestOnlyMonths = 0,
): Schedule {
  const rate = annualRate / 12;
  const months = Math.round(years * 12);
  const interestOnly = Math.min(interestOnlyMonths, months);
  const paymentAfterInterestOnly =
    months - interestOnly === 0
      ? 0
      : annuity(principal, annualRate, (months - interestOnly) / 12);

  const walk = (count: number) => {
    let balance = principal;
    let interest = 0;
    for (let month = 1; month <= count; month++) {
      const monthInterest = balance * rate;
      const payment =
        month <= interestOnly ? monthInterest : paymentAfterInterestOnly;
      interest += monthInterest;
      balance -= payment - monthInterest;
    }
    return { balance, interest };
  };

  return {
    paymentInMonth(month) {
      if (month > months) return 0;
      if (month > interestOnly) return paymentAfterInterestOnly;
      return walk(month - 1).balance * rate;
    },
    balanceAfter(count) {
      return Math.max(0, walk(Math.min(count, months)).balance);
    },
    interestInFirst(count) {
      return walk(Math.min(count, months)).interest;
    },
  };
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
    loanType,
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

  const interestOnlyMonths = LOAN_TYPES[loanType].interestOnlyYears * 12;
  const plan = schedule(
    mortgagePrincipal,
    mortgageRate,
    mortgageYears,
    interestOnlyMonths,
  );
  const mortgagePayment = plan.paymentInMonth(1);
  // Bidraget beregnes af hovedstolen og gælder derfor kun det første år.
  const mortgageContribution = (mortgagePrincipal * contributionRate) / 12;
  const mortgageMonthly = mortgagePayment + mortgageContribution;

  // Renter og bidrag er fradragsberettigede, afdraget er ikke.
  const firstYearInterest = plan.interestInFirst(12);
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
