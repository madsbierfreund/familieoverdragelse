import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { PURCHASE_PRICE, SIBLINGS } from './constants';
import {
  LOAN_TYPES,
  type LoanType,
  MORTGAGE_LTV_MAX,
} from './loanConstants';
import { borrowingLimit, calculateSettlement } from './settlement';
import { settlementInput } from './testFixtures';

const DEFAULTS = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

const TYPES = Object.keys(LOAN_TYPES) as LoanType[];

describe('borrowingLimit', () => {
  it('opfanger afrundingsstøj lige under et helt beløb', () => {
    expect(borrowingLimit(5_743_019.9999999)).toBe(5_743_020);
  });

  it('runder aldrig op over den faktiske grænse', () => {
    expect(borrowingLimit(509_111.6)).toBe(509_111);
    expect(borrowingLimit(509_111.5)).toBe(509_111);
    expect(borrowingLimit(509_111.9999)).toBe(509_111);
  });

  it('lader hele kroner stå', () => {
    expect(borrowingLimit(6_000_000)).toBe(6_000_000);
    expect(borrowingLimit(0)).toBe(0);
  });
});

describe('calculateSettlement', () => {
  it('dækker hele udligningen med et nyt realkreditlån', () => {
    const input = settlementInput(DEFAULTS);
    const r = calculateSettlement(input);

    expect(r.daughterOwes).toBe(6_000_000);
    expect(r.existingBalance).toBeCloseTo(3_385_800.85, 0);
    expect(r.maxNewPrincipal).toBeCloseTo(6_214_199.15, 0);
    expect(r.maxNewMortgageCash).toBe(6_000_000);
    expect(input.newMortgageCash).toBe(6_000_000);
    expect(r.newPrincipal).toBeCloseTo(6_122_448.98, 2);
    expect(r.noteAmount).toBe(0);
    expect(r.existingMonthly).toBeCloseTo(19_592.12, 2);
    expect(r.newMonthly).toBeCloseTo(32_349.85, 2);
    expect(r.totalMonthly).toBeCloseTo(51_941.97, 2);
    expect(r.pledgeRoom).toBeCloseTo(2_491_750.17, 2);
  });

  it('lægger resten i et pantebrev til søskendene', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, { newMortgageCash: 3_000_000 }),
    );

    expect(r.noteAmount).toBe(3_000_000);
    expect(r.noteMonthly).toBeCloseTo(30_373.54, 2);
    expect(r.notePerSibling).toBe(750_000);
    expect(r.cashPerSibling).toBe(1_250_000);
    expect(r.siblingTotal).toBe(2_000_000);
    expect(r.newMonthly).toBeCloseTo(16_174.92, 2);
    // Summen af de tre ydelser, som afrundet er 66.141 kr.
    expect(r.totalMonthly).toBeCloseTo(
      r.existingMonthly + r.newMonthly + r.noteMonthly,
      6,
    );
    expect(r.totalMonthly).toBeCloseTo(66_141, 0);
  });

  it('kræver ingen udligning, når arven dækker restgælden', () => {
    const values = { ...DEFAULTS, otherAssets: 40_000_000 };
    const r = calculateSettlement(settlementInput(values));

    expect(r.daughterOwes).toBe(0);
    expect(r.daughterReceives).toBe(1_600_000);
    expect(r.cashPerSibling).toBe(
      calculate(values).withAgreement.siblingEach,
    );
  });

  it('lader det afdragsfri lån stå urørt frem til dødsfaldet', () => {
    const input = settlementInput(DEFAULTS, {
      loanType: 'fixedInterestOnly',
    });
    const r = calculateSettlement(input);

    expect(r.existingBalance).toBeCloseTo(3_739_775.51, 2);
    expect(r.existingMonthly).toBeCloseTo(15_364.24, 2);
    expect(r.maxNewPrincipal).toBeCloseTo(5_860_224.49, 2);
    expect(r.maxNewMortgageCash).toBeCloseTo(5_743_020, 2);
    expect(input.newMortgageCash).toBeCloseTo(5_743_020, 2);
    expect(r.newMonthly).toBeCloseTo(24_075.76, 2);
    expect(r.noteAmount).toBeCloseTo(256_980, 2);
    expect(r.noteMonthly).toBeCloseTo(2_601.8, 2);
    expect(r.totalMonthly).toBeCloseTo(42_041.8, 2);
    expect(r.pledgeRoom).toBeCloseTo(2_400_000, 2);
  });

  it('afdrager flexlånet frem til dødsfaldet', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, { loanType: 'flex' }),
    );

    expect(r.existingBalance).toBeCloseTo(3_287_379.78, 2);
    expect(r.existingMonthly).toBeCloseTo(18_512.01, 2);
    expect(r.newPrincipal).toBeCloseTo(6_000_000, 2);
    expect(r.newMonthly).toBeCloseTo(30_692.68, 2);
    expect(r.noteAmount).toBe(0);
    expect(r.totalMonthly).toBeCloseTo(49_204.69, 2);
    expect(r.pledgeRoom).toBeCloseTo(2_712_620.22, 2);
  });

  it('lader hvert lån følge sin egen lånetype', () => {
    const both = settlementInput(DEFAULTS, { loanType: 'fixed' });
    const mixed = settlementInput(DEFAULTS, {
      loanType: 'fixed',
      deathLoanType: 'flex',
    });

    // Lånet fra købet rører sig ikke, når lånet ved dødsfaldet skifter type.
    expect(mixed.loanResult).toEqual(both.loanResult);
    const a = calculateSettlement(both);
    const b = calculateSettlement(mixed);
    expect(b.existingBalance).toBe(a.existingBalance);
    expect(b.existingMonthly).toBe(a.existingMonthly);

    // Det nye lån optages til flexlånets kurs 100, rente og bidrag.
    expect(b.newPrincipal).toBeCloseTo(6_000_000, 2);
    expect(b.newMonthly).toBeCloseTo(30_692.68, 2);
    expect(a.newPrincipal).toBeCloseTo(6_122_448.98, 2);
    expect(a.newMonthly).toBeCloseTo(32_349.85, 2);
  });

  it('afdrager det nye lån, selv om lånet fra købet er afdragsfrit', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, {
        loanType: 'fixedInterestOnly',
        deathLoanType: 'fixed',
      }),
    );

    // Restgælden ved dødsfaldet kommer fra lånet ved købet.
    expect(r.existingBalance).toBeCloseTo(3_739_775.51, 2);
    expect(r.existingMonthly).toBeCloseTo(15_364.24, 2);
    expect(r.noteAmount).toBeCloseTo(256_980, 2);
    // Det nye lån afdrager fra start og koster derfor mere end et afdragsfrit.
    expect(r.newPrincipal).toBeCloseTo(5_860_224.49, 2);
    expect(r.newMonthly).toBeCloseTo(30_964.3, 2);
    expect(r.totalMonthly).toBeCloseTo(48_930.35, 2);
  });

  it('stiller søskendene lige for blandede lånetyper', () => {
    for (const loanType of TYPES) {
      for (const deathLoanType of TYPES) {
        const base = settlementInput(DEFAULTS, {
          loanType,
          deathLoanType,
          newMortgageCash: 0,
        });
        const max = calculateSettlement(base).maxNewMortgageCash;
        const input = { ...base, newMortgageCash: max / 2 };
        const r = calculateSettlement(input);

        expect(r.siblingTotal).toBeCloseTo(
          base.inheritance.withAgreement.siblingEach,
          2,
        );
        expect(input.newMortgageCash + r.noteAmount).toBe(r.daughterOwes);
        expect(r.newPrincipal).toBeLessThanOrEqual(r.maxNewPrincipal + 0.01);
      }
    }
  });

  it.each(TYPES)(
    'stiller søskendene lige for tilfældige gyldige input (%s)',
    (loanType) => {
      let seed = 3_385_800;
      const random = () => {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        return seed / 2_147_483_648;
      };

      for (let i = 0; i < 200; i++) {
        const values = {
          marketValue: 6_000_000 + Math.round(random() * 12_000_000),
          otherAssets: Math.round(random() * 30_000_000),
          ownFinancing: Math.round(random() * PURCHASE_PRICE),
        };
        const base = settlementInput(values, {
          loanType,
          newMortgageCash: 0,
        });
        const max = calculateSettlement(base).maxNewMortgageCash;
        const input = {
          ...base,
          newMortgageCash: Math.floor(random() * max),
        };
        const r = calculateSettlement(input);

        expect(r.siblingTotal).toBeCloseTo(
          base.inheritance.withAgreement.siblingEach,
          2,
        );
        expect(input.newMortgageCash + r.noteAmount).toBe(r.daughterOwes);
        expect(r.newPrincipal).toBeLessThanOrEqual(r.maxNewPrincipal + 0.01);
        expect(r.notePerSibling * SIBLINGS).toBeCloseTo(r.noteAmount, 6);
      }
    },
  );

  it('kan ikke belåne mere end friværdien tillader', () => {
    const r = calculateSettlement(settlementInput(DEFAULTS));

    expect(r.maxNewPrincipal).toBeCloseTo(
      MORTGAGE_LTV_MAX * DEFAULTS.marketValue - r.existingBalance,
      6,
    );
  });
});
