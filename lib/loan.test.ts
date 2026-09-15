import { describe, expect, it } from 'vitest';
import { PURCHASE_PRICE } from './constants';
import { annuity, calculateLoan, type LoanInput } from './loan';
import {
  DEFAULT_BANK_RATE,
  DEFAULT_BANK_YEARS,
  DEFAULT_BOND_PRICE,
  DEFAULT_CONTRIBUTION_RATE,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_YEARS,
  MIN_DOWN_PAYMENT_SHARE,
} from './loanConstants';

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

describe('annuity', () => {
  it('beregner den månedlige ydelse på et annuitetslån', () => {
    expect(annuity(1_000_000, 0.06, 20)).toBeCloseTo(7_164.31, 2);
  });

  it('fordeler hovedstolen ligeligt ved rente 0', () => {
    expect(annuity(1_000_000, 0, 20)).toBe(1_000_000 / (20 * 12));
  });

  it('giver ingen ydelse uden lån', () => {
    expect(annuity(0, 0.06, 20)).toBe(0);
  });
});

describe('calculateLoan', () => {
  it('belåner markedsværdien', () => {
    const r = calculateLoan(BASE);

    expect(r.maxMortgageCash).toBe(9_600_000);
    expect(r.mortgageCash).toBe(3_664_980);
    expect(r.bankLoan).toBe(0);
    expect(r.mortgagePrincipal).toBeCloseTo(3_739_775.51, 2);
    expect(r.downPaymentShortfall).toBe(0);
  });

  it('belåner købesummen', () => {
    const r = calculateLoan({ ...BASE, lendingBasis: 'purchase' });

    expect(r.maxMortgageCash).toBe(5_360_320);
    expect(r.mortgageCash).toBe(3_664_980);
    expect(r.bankLoan).toBe(0);
  });

  it('lægger resten i et banklån, når realkreditgrænsen er nået', () => {
    const r = calculateLoan({
      ...BASE,
      ownFinancing: PURCHASE_PRICE,
      lendingBasis: 'purchase',
    });

    expect(r.mortgageCash).toBe(5_360_320);
    expect(r.bankLoan).toBe(1_005_060);
  });

  it('måler udbetalingen mod långiveres krav', () => {
    const r = calculateLoan({ ...BASE, downPayment: 0 });

    expect(r.downPaymentShortfall).toBe(335_020);
  });

  it('beregner ydelse og bidrag på realkreditlånet', () => {
    const r = calculateLoan(BASE);

    expect(r.mortgagePayment).toBeGreaterThan(17_900);
    expect(r.mortgagePayment).toBeLessThan(18_100);
    expect(r.mortgageContribution).toBeCloseTo(1_776.39, 2);
    expect(r.mortgageMonthly).toBeCloseTo(
      r.mortgagePayment + r.mortgageContribution,
      6,
    );
  });

  it('fordeler hele egenfinansieringen for tilfældige gyldige input', () => {
    let seed = 6_700_400;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    for (let i = 0; i < 200; i++) {
      const ownFinancing = Math.round(random() * PURCHASE_PRICE);
      const input: LoanInput = {
        ...BASE,
        marketValue: Math.round(random() * 20_000_000),
        ownFinancing,
        lendingBasis: random() < 0.5 ? 'market' : 'purchase',
        downPayment: Math.round(random() * ownFinancing),
      };
      const r = calculateLoan(input);

      expect(input.downPayment + r.mortgageCash + r.bankLoan).toBe(
        input.ownFinancing,
      );
      expect(r.mortgageCash).toBeLessThanOrEqual(r.maxMortgageCash);
    }
  });
});
