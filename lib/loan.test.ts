import { describe, expect, it } from 'vitest';
import { PURCHASE_PRICE } from './constants';
import { annuity, calculateLoan, type LoanInput } from './loan';
import {
  DEFAULT_BOND_PRICE,
  DEFAULT_CONTRIBUTION_RATE,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_YEARS,
  MIN_DOWN_PAYMENT_SHARE,
  MORTGAGE_LTV_MAX,
  TAX_DEDUCTION_RATE_LOW,
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
    expect(r.mortgagePrincipal).toBeCloseTo(3_739_775.51, 2);
    expect(r.downPaymentShortfall).toBe(0);
    expect(r.minDownPaymentForLtv).toBe(0);
    expect(r.totalDebt).toBe(r.mortgagePrincipal);
  });

  it('belåner købesummen', () => {
    const r = calculateLoan({ ...BASE, lendingBasis: 'purchase' });

    expect(r.maxMortgageCash).toBe(5_360_320);
    expect(r.mortgageCash).toBe(3_664_980);
  });

  it('kræver en større udbetaling, når lånebehovet overstiger grænsen', () => {
    const r = calculateLoan({
      ...BASE,
      ownFinancing: PURCHASE_PRICE,
      lendingBasis: 'purchase',
    });

    expect(r.toFinance).toBeGreaterThan(r.maxMortgageCash);
    expect(r.minDownPaymentForLtv).toBe(1_340_080);
  });

  it('holder sig inden for grænsen med den krævede udbetaling', () => {
    const r = calculateLoan({
      ...BASE,
      ownFinancing: PURCHASE_PRICE,
      lendingBasis: 'purchase',
      downPayment: 1_340_080,
    });

    expect(r.toFinance).toBeLessThanOrEqual(r.maxMortgageCash);
    expect(r.mortgageCash).toBe(5_360_320);
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
    expect(r.totalMonthly).toBe(r.mortgageMonthly);
  });

  it('anslår fradraget og ydelsen efter skat', () => {
    const r = calculateLoan(BASE);

    expect(r.firstYearInterest).toBeGreaterThan(150_000);
    expect(r.firstYearInterest).toBeLessThan(151_300);
    expect(r.firstYearContribution).toBeCloseTo(21_316.72, 2);
    expect(r.deductible).toBeCloseTo(
      r.firstYearInterest + r.firstYearContribution,
      6,
    );
    expect(r.taxSavingYear).toBeGreaterThan(46_800);
    expect(r.taxSavingYear).toBeLessThan(47_200);
    expect(r.taxSavingMonthly).toBeCloseTo(r.taxSavingYear / 12, 6);
    expect(r.monthlyAfterTax).toBeGreaterThan(15_800);
    expect(r.monthlyAfterTax).toBeLessThan(15_900);
  });

  it('bruger den lave sats, når fradraget er under grænsen', () => {
    // Et lille lån holder renter og bidrag under de 50.000 kr.
    const r = calculateLoan({
      ...BASE,
      ownFinancing: 500_000,
      downPayment: 100_000,
    });

    expect(r.deductible).toBeLessThan(50_000);
    expect(r.taxSavingYear).toBeCloseTo(r.deductible * TAX_DEDUCTION_RATE_LOW, 6);
  });

  it('giver intet fradrag uden lån', () => {
    const r = calculateLoan({ ...BASE, downPayment: BASE.ownFinancing });

    expect(r.mortgagePrincipal).toBe(0);
    expect(r.firstYearInterest).toBe(0);
    expect(r.firstYearContribution).toBe(0);
    expect(r.deductible).toBe(0);
    expect(r.taxSavingYear).toBe(0);
    expect(r.taxSavingMonthly).toBe(0);
    expect(r.monthlyAfterTax).toBe(0);
  });

  it('fordeler hele egenfinansieringen for tilfældige gyldige input', () => {
    let seed = 6_700_400;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    for (let i = 0; i < 200; i++) {
      const marketValue = Math.round(random() * 20_000_000);
      const ownFinancing = Math.round(random() * PURCHASE_PRICE);
      const lendingBasis = random() < 0.5 ? 'market' : 'purchase';

      // Udbetalingen skal være stor nok til, at realkredit kan dække resten.
      const basis =
        lendingBasis === 'market'
          ? Math.max(marketValue, PURCHASE_PRICE)
          : PURCHASE_PRICE;
      const minDown = Math.ceil(
        Math.max(0, ownFinancing - MORTGAGE_LTV_MAX * basis),
      );
      const downPayment =
        minDown + Math.round(random() * (ownFinancing - minDown));

      const input: LoanInput = {
        ...BASE,
        marketValue,
        ownFinancing,
        lendingBasis,
        downPayment,
      };
      const r = calculateLoan(input);

      expect(input.downPayment + r.mortgageCash).toBe(input.ownFinancing);
      expect(r.mortgageCash).toBeLessThanOrEqual(r.maxMortgageCash);

      // Ydelserne i det første år er renter plus afdrag. Restgælden efter
      // tolv ydelser tages fra annuitetsformlen, uafhængigt af summen ovenfor.
      const rate = input.mortgageRate / 12;
      const growth = Math.pow(1 + rate, 12);
      const balance =
        r.mortgagePrincipal * growth -
        (r.mortgagePayment * (growth - 1)) / rate;
      const repaid = r.mortgagePrincipal - balance;
      expect(
        Math.abs(r.firstYearInterest + repaid - 12 * r.mortgagePayment),
      ).toBeLessThan(1);
      if (r.mortgagePrincipal > 0) {
        expect(r.monthlyAfterTax).toBeLessThan(r.totalMonthly);
      }
    }
  });
});
