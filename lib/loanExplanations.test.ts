import { describe, expect, it } from 'vitest';
import { PURCHASE_PRICE } from './constants';
import { calculateLoan, type LoanInput } from './loan';
import {
  DEFAULT_BANK_RATE,
  DEFAULT_BANK_YEARS,
  DEFAULT_BOND_PRICE,
  DEFAULT_CONTRIBUTION_RATE,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_YEARS,
  MIN_DOWN_PAYMENT_SHARE,
} from './loanConstants';
import { explainLoan } from './loanExplanations';

const BASE: LoanInput = {
  marketValue: 12_000_000,
  ownFinancing: 4_000_000,
  lendingBasis: 'market',
  downPayment: MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE,
  mortgageRate: DEFAULT_MORTGAGE_RATE,
  contributionRate: DEFAULT_CONTRIBUTION_RATE,
  bondPrice: DEFAULT_BOND_PRICE,
  mortgageYears: DEFAULT_MORTGAGE_YEARS,
  bankRate: DEFAULT_BANK_RATE,
  bankYears: DEFAULT_BANK_YEARS,
};

function texts(input: LoanInput) {
  return explainLoan(input, calculateLoan(input));
}

describe('explainLoan', () => {
  it('forklarer egenfinansieringen med gældsbrevet til faren', () => {
    expect(texts(BASE).ownFinancing).toBe(
      'Den del af købesummen på 6.700.400 kr., som datteren selv finansierer. ' +
        'Resten på 2.700.400 kr. lånes af faren via gældsbrevet.',
    );
  });

  it('forklarer egenfinansieringen, når hele købesummen betales selv', () => {
    expect(texts({ ...BASE, ownFinancing: PURCHASE_PRICE }).ownFinancing).toBe(
      'Datteren finansierer hele købesummen på 6.700.400 kr. selv.',
    );
  });
});
