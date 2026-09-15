import { describe, expect, it } from 'vitest';
import { PURCHASE_PRICE } from './constants';
import {
  annuity,
  calculateLoan,
  schedule,
  taxSaving,
  type LoanInput,
} from './loan';
import {
  LOAN_TYPES,
  type LoanType,
  MORTGAGE_LTV_MAX,
  TAX_DEDUCTION_RATE_LOW,
} from './loanConstants';
import { loanInput } from './testFixtures';

const BASE = loanInput('fixed');
const TYPES = Object.keys(LOAN_TYPES) as LoanType[];

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

describe('taxSaving', () => {
  it('bruger den høje sats op til grænsen og den lave derover', () => {
    expect(taxSaving(0)).toBe(0);
    expect(taxSaving(40_000)).toBeCloseTo(40_000 * 0.33, 6);
    expect(taxSaving(50_000)).toBeCloseTo(16_500, 6);
    expect(taxSaving(171_947.68)).toBeCloseTo(46_986.92, 2);
  });
});

describe('schedule', () => {
  it('lader gælden stå stille i den afdragsfri periode', () => {
    const principal = 3_739_775.51;
    const plan = schedule(principal, 0.0406, 30, 120);

    expect(plan.balanceAfter(120)).toBeCloseTo(principal, 6);
    expect(plan.paymentInMonth(1)).toBeCloseTo((principal * 0.0406) / 12, 6);
    expect(plan.paymentInMonth(121)).toBeCloseTo(
      annuity(principal, 0.0406, (360 - 120) / 12),
      6,
    );
  });

  it('svarer til et almindeligt annuitetslån uden afdragsfrihed', () => {
    let seed = 4_060_000;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    for (let i = 0; i < 200; i++) {
      const principal = Math.round(random() * 8_000_000);
      const rate = random() * 0.1;
      const years = 1 + Math.floor(random() * 30);
      const plan = schedule(principal, rate, years, 0);
      const payment = annuity(principal, rate, years);
      const monthRate = rate / 12;
      const months = Math.min(12 + Math.floor(random() * 100), years * 12);

      expect(plan.paymentInMonth(1)).toBe(payment);
      expect(plan.paymentInMonth(months)).toBe(payment);

      // Restgælden efter annuitetsformlen, uafhængigt af planens løkke.
      const growth = Math.pow(1 + monthRate, months);
      const expected =
        principal * growth - (payment * (growth - 1)) / (monthRate || 1);
      if (monthRate > 0) {
        expect(plan.balanceAfter(months)).toBeCloseTo(Math.max(0, expected), 4);
      }
    }
  });
});

describe('calculateLoan', () => {
  it('belåner markedsværdien', () => {
    const r = calculateLoan(BASE);

    expect(r.maxMortgageCash).toBe(9_600_000);
    expect(r.mortgageCash).toBe(3_664_980);
    expect(r.mortgagePrincipal).toBeCloseTo(3_739_775.51, 2);
    expect(r.mortgagePayment).toBeCloseTo(17_983.86, 2);
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

  it('beregner ydelse og bidrag ved fast rente med afdrag', () => {
    const r = calculateLoan(BASE);

    expect(r.mortgagePayment).toBeGreaterThan(17_900);
    expect(r.mortgagePayment).toBeLessThan(18_100);
    expect(r.mortgageContribution).toBeCloseTo(1_776.39, 2);
    expect(r.totalMonthly).toBeCloseTo(19_760.26, 2);
  });

  it('anslår fradraget og ydelsen efter skat ved fast rente med afdrag', () => {
    const r = calculateLoan(BASE);

    expect(r.firstYearInterest).toBeGreaterThan(150_000);
    expect(r.firstYearInterest).toBeLessThan(151_300);
    expect(r.firstYearContribution).toBeCloseTo(21_316.72, 2);
    expect(r.taxSavingYear).toBeGreaterThan(46_800);
    expect(r.taxSavingYear).toBeLessThan(47_200);
    expect(r.monthlyAfterTax).toBeCloseTo(15_844.68, 2);
  });

  it('betaler kun rente og bidrag i den afdragsfri periode', () => {
    const r = calculateLoan(loanInput('fixedInterestOnly'));

    expect(r.mortgagePrincipal).toBeCloseTo(3_739_775.51, 2);
    expect(r.mortgagePayment).toBeCloseTo(12_652.91, 2);
    expect(r.totalMonthly).toBeCloseTo(15_364.24, 2);
    expect(r.deductible).toBeCloseTo(184_370.93, 2);
    expect(r.taxSavingYear).toBeCloseTo(50_092.73, 2);
    expect(r.monthlyAfterTax).toBeCloseTo(11_189.85, 2);
  });

  it('regner flexlån til kurs 100', () => {
    const r = calculateLoan(loanInput('flex'));

    expect(r.mortgagePrincipal).toBe(3_664_980);
    expect(r.mortgagePayment).toBeCloseTo(16_457.4, 2);
    expect(r.totalMonthly).toBeCloseTo(18_748.01, 2);
    expect(r.deductible).toBeCloseTo(154_640.47, 2);
    expect(r.taxSavingYear).toBeCloseTo(42_660.12, 2);
    expect(r.monthlyAfterTax).toBeCloseTo(15_193.0, 2);
  });

  it('bruger den lave sats, når fradraget er under grænsen', () => {
    // Et lille lån holder renter og bidrag under de 50.000 kr.
    const r = calculateLoan({
      ...BASE,
      ownFinancing: 500_000,
      downPayment: 100_000,
    });

    expect(r.deductible).toBeLessThan(50_000);
    expect(r.taxSavingYear).toBeCloseTo(
      r.deductible * TAX_DEDUCTION_RATE_LOW,
      6,
    );
  });

  it.each(TYPES)('giver intet fradrag uden lån (%s)', (loanType) => {
    const input = loanInput(loanType);
    const r = calculateLoan({ ...input, downPayment: input.ownFinancing });

    expect(r.mortgagePrincipal).toBe(0);
    expect(r.mortgagePayment).toBe(0);
    expect(r.firstYearInterest).toBe(0);
    expect(r.deductible).toBe(0);
    expect(r.taxSavingYear).toBe(0);
    expect(r.monthlyAfterTax).toBe(0);
  });

  it.each(TYPES)(
    'fordeler hele egenfinansieringen for tilfældige gyldige input (%s)',
    (loanType) => {
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

        const input: LoanInput = loanInput(loanType, {
          marketValue,
          ownFinancing,
          lendingBasis,
          downPayment,
        });
        const r = calculateLoan(input);

        expect(input.downPayment + r.mortgageCash).toBe(input.ownFinancing);
        expect(r.mortgageCash).toBeLessThanOrEqual(r.maxMortgageCash);

        // Ydelserne i det første år er renter plus afdrag.
        const months = 12;
        const repaid =
          r.mortgagePrincipal -
          schedule(
            r.mortgagePrincipal,
            input.mortgageRate,
            input.mortgageYears,
            LOAN_TYPES[loanType].interestOnlyYears * 12,
          ).balanceAfter(months);
        expect(
          Math.abs(r.firstYearInterest + repaid - months * r.mortgagePayment),
        ).toBeLessThan(1);

        if (r.mortgagePrincipal > 0) {
          expect(r.monthlyAfterTax).toBeLessThan(r.totalMonthly);
        }
      }
    },
  );
});
