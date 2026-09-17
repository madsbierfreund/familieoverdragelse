import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { PURCHASE_PRICE, SIBLINGS } from './constants';
import { calculateLoan } from './loan';
import { LOAN_TYPES } from './loanConstants';
import { calculateSettlement } from './settlement';
import { loanInput, settlementInput } from './testFixtures';
import {
  calculateValueLinked,
  type RedemptionFinancing,
  type ValueLinkedInput,
} from './valueLinked';

const DEFAULTS = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

/** Samler et input med købslånets vilkår, som afsnittet gør det. */
function valueLinkedInput(
  overrides: Partial<ValueLinkedInput> & {
    values?: typeof DEFAULTS;
  } = {},
): ValueLinkedInput {
  const { values = DEFAULTS, ...rest } = overrides;
  const loan = loanInput('fixed', {
    marketValue: values.marketValue,
    ownFinancing: values.ownFinancing,
  });

  return {
    marketValue: values.marketValue,
    otherAssets: values.otherAssets,
    ownFinancing: values.ownFinancing,
    deathYears: 5,
    priceGrowth: 0.02,
    redemptionYears: 0,
    financing: 'mortgage',
    noteRate: 0.04,
    noteYears: 10,
    loan: {
      rate: loan.mortgageRate,
      contributionRate: loan.contributionRate,
      bondPrice: loan.bondPrice,
      mortgageYears: loan.mortgageYears,
      interestOnlyYears: LOAN_TYPES[loan.loanType].interestOnlyYears,
      mortgagePrincipal: calculateLoan(loan).mortgagePrincipal,
    },
    ...rest,
  };
}

describe('calculateValueLinked', () => {
  it('opgør gælden efter den ubetalte andel af den nye værdi', () => {
    const r = calculateValueLinked(valueLinkedInput());

    expect(r.paidShare).toBeCloseTo(1 / 3, 10);
    expect(r.valueAtDeath).toBeCloseTo(13_248_969.64, 2);
    expect(r.estateMass).toBeCloseTo(10_832_646.43, 2);
    expect(r.share).toBeCloseTo(2_166_529.29, 2);
    expect(r.debtAtDeath).toBeCloseTo(6_666_117.14, 2);
    expect(r.siblingsShareOfProperty).toBeCloseTo(0.503142, 6);
  });

  it('indfrier ved dødsfaldet', () => {
    const r = calculateValueLinked(valueLinkedInput());

    expect(r.debtAtRedemption).toBeCloseTo(6_666_117.14, 2);
    expect(r.siblingsGrowth).toBeCloseTo(0, 2);
    expect(r.principal).toBeCloseTo(6_802_160.35, 2);
    expect(r.monthly).toBeCloseTo(35_941.31, 2);
    expect(r.existingAtRedemption).toBeCloseTo(3_385_800.85, 2);
    expect(r.maxPrincipal).toBeCloseTo(7_213_374.86, 2);
    expect(r.valid).toBe(true);

    const note = calculateValueLinked(valueLinkedInput({ financing: 'note' }));
    expect(note.monthly).toBeCloseTo(67_491.2, 2);
  });

  it('lader gælden følge værdien frem til en senere indfrielse', () => {
    const r = calculateValueLinked(valueLinkedInput({ redemptionYears: 5 }));

    expect(r.valueAtRedemption).toBeCloseTo(14_627_933.04, 2);
    expect(r.debtAtRedemption).toBeCloseTo(7_359_931.97, 2);
    expect(r.siblingsGrowth).toBeCloseTo(693_814.83, 2);
    expect(r.existingAtRedemption).toBeCloseTo(2_952_304.79, 2);
    expect(r.maxPrincipal).toBeCloseTo(8_750_041.64, 2);
    expect(r.principal).toBeCloseTo(7_510_134.66, 2);
    expect(r.monthly).toBeCloseTo(39_682.11, 2);
    expect(r.valid).toBe(true);

    const note = calculateValueLinked(
      valueLinkedInput({ redemptionYears: 5, financing: 'note' }),
    );
    expect(note.monthly).toBeCloseTo(74_515.73, 2);
  });

  it('svarer til udligningen, når priserne ikke stiger', () => {
    const r = calculateValueLinked(valueLinkedInput({ priceGrowth: 0 }));
    const { daughterPays } = calculate(DEFAULTS, 5).withAgreement;

    expect(daughterPays).toBeGreaterThan(0);
    expect(r.debtAtDeath).toBeCloseTo(6_000_000, 2);
    expect(r.debtAtDeath).toBeCloseTo(daughterPays, 2);

    for (const redemptionYears of [0, 5, 20]) {
      expect(
        calculateValueLinked(
          valueLinkedInput({ priceGrowth: 0, redemptionYears }),
        ).siblingsGrowth,
      ).toBeCloseTo(0, 6);
    }
  });

  it('giver datteren penge, når arven overstiger den ubetalte andel', () => {
    const r = calculateValueLinked(
      valueLinkedInput({ values: { ...DEFAULTS, otherAssets: 40_000_000 } }),
    );

    expect(r.debtAtDeath).toBe(0);
    expect(r.daughterReceives).toBeGreaterThan(0);
    expect(r.debtAtRedemption).toBe(0);
    expect(r.valueAtRedemption).toBe(0);
    expect(r.siblingsGrowth).toBe(0);
    expect(r.monthly).toBe(0);
    expect(r.principal).toBe(0);
  });

  it('regulerer gælden med værdien for tilfældige gyldige input', () => {
    let seed = 6_666_117;
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
      const priceGrowth = random() * 0.1;
      const redemptionYears = Math.floor(random() * 31);
      const financing: RedemptionFinancing =
        random() < 0.5 ? 'note' : 'mortgage';
      const input = valueLinkedInput({
        values,
        priceGrowth,
        redemptionYears,
        financing,
        deathYears: 1 + Math.floor(random() * 30),
      });
      const r = calculateValueLinked(input);

      if (r.debtAtDeath > 0) {
        expect(r.debtAtRedemption).toBeCloseTo(
          r.debtAtDeath * Math.pow(1 + priceGrowth, redemptionYears),
          6,
        );
      }

      // Uden prisstigning er gælden søskendenes arvelodder minus formuen.
      const flat = calculateValueLinked({ ...input, priceGrowth: 0 });
      const paid = Math.min(1, values.ownFinancing / values.marketValue);
      const mass = values.otherAssets + (1 - paid) * values.marketValue;
      expect(flat.debtAtDeath).toBeCloseTo(
        Math.max(0, (SIBLINGS * mass) / 5 - values.otherAssets),
        6,
      );
    }
  });

  it('rører ikke de eksisterende beregninger', () => {
    const inheritance = calculate(DEFAULTS, 5);
    const loan = calculateLoan(loanInput('fixed'));
    const settlement = calculateSettlement(settlementInput(DEFAULTS));

    calculateValueLinked(valueLinkedInput({ redemptionYears: 7 }));

    expect(calculate(DEFAULTS, 5)).toEqual(inheritance);
    expect(calculateLoan(loanInput('fixed'))).toEqual(loan);
    expect(calculateSettlement(settlementInput(DEFAULTS))).toEqual(settlement);
  });
});
