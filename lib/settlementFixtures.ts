import { calculate, type CalculationInput } from './calculate';
import { PURCHASE_PRICE } from './constants';
import { calculateLoan, type LoanInput } from './loan';
import {
  DEFAULT_BOND_PRICE,
  DEFAULT_CONTRIBUTION_RATE,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_YEARS,
  MIN_DOWN_PAYMENT_SHARE,
} from './loanConstants';
import { calculateSettlement, type SettlementInput } from './settlement';
import { DEFAULT_NOTE_RATE, DEFAULT_NOTE_YEARS } from './settlementConstants';

interface Overrides {
  loan?: Partial<LoanInput>;
  newMortgageCash?: number;
  noteRate?: number;
  noteYears?: number;
}

/**
 * Samler standardværdierne fra de to foregående afsnit til en udligning,
 * så prøverne kan nøjes med at ændre det, de handler om. Bruges kun i test.
 */
export function settlementInput(
  values: CalculationInput,
  overrides: Overrides = {},
): SettlementInput {
  const loan: LoanInput = {
    marketValue: values.marketValue,
    ownFinancing: values.ownFinancing,
    lendingBasis: 'market',
    downPayment: MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE,
    mortgageRate: DEFAULT_MORTGAGE_RATE,
    contributionRate: DEFAULT_CONTRIBUTION_RATE,
    bondPrice: DEFAULT_BOND_PRICE,
    mortgageYears: DEFAULT_MORTGAGE_YEARS,
    ...overrides.loan,
  };

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
