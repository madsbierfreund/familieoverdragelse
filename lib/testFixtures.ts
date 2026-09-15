import { calculate, type CalculationInput } from './calculate';
import { PURCHASE_PRICE } from './constants';
import { calculateLoan, type LoanInput } from './loan';
import {
  DEFAULT_LOAN_TYPE,
  DEFAULT_MORTGAGE_YEARS,
  LOAN_TYPES,
  type LoanType,
  MIN_DOWN_PAYMENT_SHARE,
} from './loanConstants';
import { calculateSettlement, type SettlementInput } from './settlement';
import { DEFAULT_NOTE_RATE, DEFAULT_NOTE_YEARS } from './settlementConstants';

/**
 * Standardværdierne fra siden, med lånetypens egne satser.
 * Bruges kun i test.
 */
export function loanInput(
  loanType: LoanType = DEFAULT_LOAN_TYPE,
  overrides: Partial<LoanInput> = {},
): LoanInput {
  const type = LOAN_TYPES[loanType];
  return {
    marketValue: 12_000_000,
    ownFinancing: 4_000_000,
    lendingBasis: 'market',
    loanType,
    downPayment: MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE,
    mortgageRate: type.rate,
    contributionRate: type.contribution,
    bondPrice: type.bondPrice,
    mortgageYears: DEFAULT_MORTGAGE_YEARS,
    ...overrides,
  };
}

interface Overrides {
  loanType?: LoanType;
  loan?: Partial<LoanInput>;
  newMortgageCash?: number;
  noteRate?: number;
  noteYears?: number;
}

/**
 * Samler de to foregående afsnit til en udligning, så prøverne kan nøjes med
 * at ændre det, de handler om. Bruges kun i test.
 */
export function settlementInput(
  values: CalculationInput,
  overrides: Overrides = {},
): SettlementInput {
  const loan = loanInput(overrides.loanType ?? DEFAULT_LOAN_TYPE, {
    marketValue: values.marketValue,
    ownFinancing: values.ownFinancing,
    ...overrides.loan,
  });

  const input: SettlementInput = {
    inheritance: calculate(values),
    otherAssets: values.otherAssets,
    loan,
    loanResult: calculateLoan(loan),
    newMortgageCash: 0,
    noteRate: overrides.noteRate ?? DEFAULT_NOTE_RATE,
    noteYears: overrides.noteYears ?? DEFAULT_NOTE_YEARS,
  };

  // Uden andet valg lånes det, belåningsgrænsen tillader.
  return {
    ...input,
    newMortgageCash:
      overrides.newMortgageCash ??
      calculateSettlement(input).maxNewMortgageCash,
  };
}
