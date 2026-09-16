import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { GIFT_YEARS, PURCHASE_PRICE, SIBLINGS } from './constants';
import {
  LOAN_TYPES,
  type LoanType,
  MORTGAGE_LTV_MAX,
} from './loanConstants';
import {
  MAX_DEATH_YEARS,
  MIN_DEATH_YEARS,
} from './settlementConstants';
import { toTodaysValue } from './inflation';
import { borrowingLimit, calculateSettlement } from './settlement';
import { DEFAULT_INFLATION_RATE } from './settlementConstants';
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

describe('calculateSettlement med stigende boligpriser', () => {
  it('lader alle tal stå, når priserne ikke stiger', () => {
    for (const loanType of TYPES) {
      for (const deathLoanType of TYPES) {
        const base = settlementInput(DEFAULTS, { loanType, deathLoanType });
        const flat = settlementInput(DEFAULTS, {
          loanType,
          deathLoanType,
          priceGrowth: 0,
          newMortgageCash: base.newMortgageCash,
        });

        expect(calculateSettlement(flat)).toEqual(calculateSettlement(base));
        expect(calculateSettlement(flat).marketValueAtDeath).toBe(
          DEFAULTS.marketValue,
        );
      }
    }
  });

  it('giver plads til et større lån, når anparten stiger i værdi', () => {
    const io = calculateSettlement(
      settlementInput(DEFAULTS, {
        loanType: 'fixedInterestOnly',
        priceGrowth: 0.02,
      }),
    );

    expect(io.marketValueAtDeath).toBeCloseTo(13_248_969.64, 2);
    expect(io.maxNewPrincipal).toBeCloseTo(6_859_400.2, 2);
    expect(io.newMortgageCash).toBeCloseTo(6_000_000, 2);
    expect(io.noteAmount).toBeCloseTo(0, 2);
    expect(io.newMonthly).toBeCloseTo(25_153.06, 2);
    // 40.517,3056 — inden for den ene øre, tallet er opgivet med.
    expect(Math.abs(io.totalMonthly - 40_517.3)).toBeLessThan(0.01);
    expect(io.pledgeRoom).toBeCloseTo(3_386_745.15, 2);

    const fixed = calculateSettlement(
      settlementInput(DEFAULTS, { priceGrowth: 0.02 }),
    );
    expect(fixed.maxNewPrincipal).toBeCloseTo(7_213_374.86, 2);
    expect(fixed.pledgeRoom).toBeCloseTo(3_740_719.81, 2);
    expect(fixed.totalMonthly).toBeCloseTo(51_941.97, 2);
  });

  it('rører ikke arveberegningen', () => {
    const base = settlementInput(DEFAULTS).inheritance;

    for (const priceGrowth of [0, 0.02, 0.05, 0.1]) {
      expect(settlementInput(DEFAULTS, { priceGrowth }).inheritance).toEqual(
        base,
      );
    }
  });

  it('viser anpartens værdi og friværdien i dagens kroner', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, { priceGrowth: 0.02 }),
    );
    const today = (amount: number) =>
      toTodaysValue(amount, DEFAULT_INFLATION_RATE, GIFT_YEARS);

    expect(today(r.marketValueAtDeath)).toBeCloseTo(11_428_678, 0);
    expect(today(r.pledgeRoom)).toBeCloseTo(3_226_778, 0);
  });
});

describe('calculateSettlement med et andet dødsår', () => {
  const at = (deathYears: number) =>
    calculateSettlement(settlementInput(DEFAULTS, { deathYears }));

  it('afdrager lånet længere, når dødsfaldet ligger senere', () => {
    const ten = at(10);

    expect(ten.daughterOwes).toBe(6_000_000);
    expect(ten.existingBalance).toBeCloseTo(2_952_304.79, 2);
    expect(ten.existingMonthly).toBeCloseTo(19_386.21, 2);
    expect(ten.newMonthly).toBeCloseTo(32_349.85, 2);
    expect(ten.totalMonthly).toBeCloseTo(51_736.06, 2);

    const twenty = at(20);
    expect(twenty.existingBalance).toBeCloseTo(1_771_276.32, 2);
    expect(twenty.totalMonthly).toBeCloseTo(51_175.07, 2);
  });

  it('har intet eksisterende lån tilbage efter hele løbetiden', () => {
    const thirty = at(30);

    expect(thirty.existingBalance).toBeCloseTo(0, 0);
    expect(thirty.existingMonthly).toBe(0);
    expect(thirty.totalMonthly).toBeCloseTo(32_349.85, 2);
  });

  it('lader det skyldige beløb være det samme uanset dødsår', () => {
    for (let years = MIN_DEATH_YEARS; years <= MAX_DEATH_YEARS; years++) {
      expect(at(years).daughterOwes).toBeCloseTo(6_000_000, 2);
    }
  });

  it('viser ydelsen i dagens kroner for hvert dødsår', () => {
    const shown = (years: number) =>
      toTodaysValue(at(years).totalMonthly, DEFAULT_INFLATION_RATE, years);

    expect(shown(5)).toBeCloseTo(44_806, 0);
    expect(shown(10)).toBeCloseTo(38_496, 0);
    expect(shown(20)).toBeCloseTo(28_334, 0);
    expect(shown(30)).toBeCloseTo(13_328, 0);
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

  it('anslår ydelsen efter skat ved fast rente med afdrag', () => {
    const r = calculateSettlement(settlementInput(DEFAULTS));

    expect(r.existingDeductible).toBeCloseTo(155_288.18, 2);
    expect(r.newDeductible).toBeCloseTo(281_498.41, 2);
    expect(r.noteDeductible).toBe(0);
    expect(r.taxSavingYear).toBeCloseTo(113_196.65, 2);
    expect(r.existingAfterTax).toBeCloseTo(16_238.44, 2);
    expect(r.newAfterTax).toBeCloseTo(26_270.47, 2);
    expect(r.noteAfterTax).toBe(0);
    expect(r.totalAfterTax).toBeCloseTo(42_508.91, 2);
  });

  it('anslår ydelsen efter skat ved afdragsfrihed', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, { loanType: 'fixedInterestOnly' }),
    );

    expect(r.existingDeductible).toBeCloseTo(184_370.93, 2);
    expect(r.newDeductible).toBeCloseTo(288_909.07, 2);
    expect(r.noteDeductible).toBeCloseTo(9_890.96, 2);
    expect(r.taxSavingYear).toBeCloseTo(124_792.74, 2);
    expect(r.existingAfterTax).toBeCloseTo(11_395.99, 2);
    expect(r.newAfterTax).toBeCloseTo(17_857.5, 2);
    expect(r.noteAfterTax).toBeCloseTo(2_388.91, 2);
    expect(r.totalAfterTax).toBeCloseTo(31_642.4, 2);
  });

  it('anslår ydelsen efter skat ved flexlån', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, { loanType: 'flex' }),
    );

    expect(r.totalDeductible).toBeCloseTo(391_542.87, 2);
    expect(r.existingAfterTax).toBeCloseTo(15_511.32, 2);
    expect(r.newAfterTax).toBeCloseTo(25_202.89, 2);
    expect(r.totalAfterTax).toBeCloseTo(40_714.22, 2);
  });

  it('anslår ydelsen efter skat, når lånene har hver sin type', () => {
    const r = calculateSettlement(
      settlementInput(DEFAULTS, {
        loanType: 'fixedInterestOnly',
        deathLoanType: 'fixed',
      }),
    );

    expect(r.existingAfterTax).toBeCloseTo(11_390.65, 2);
    expect(r.newAfterTax).toBeCloseTo(25_157.24, 2);
    expect(r.noteAfterTax).toBeCloseTo(2_388.63, 2);
    expect(r.totalAfterTax).toBeCloseTo(38_936.52, 2);
  });

  it('fordeler skatteværdien fuldt ud på de tre lån', () => {
    let seed = 1_131_966;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    for (const loanType of TYPES) {
      for (const deathLoanType of TYPES) {
        for (let i = 0; i < 20; i++) {
          const values = {
            marketValue: 6_000_000 + Math.round(random() * 12_000_000),
            otherAssets: Math.round(random() * 30_000_000),
            ownFinancing: Math.round(random() * PURCHASE_PRICE),
          };
          const base = settlementInput(values, {
            loanType,
            deathLoanType,
            // Udbetalingen kan aldrig overstige egenfinansieringen.
            loan: { downPayment: Math.floor(random() * values.ownFinancing) },
            newMortgageCash: 0,
          });
          const max = calculateSettlement(base).maxNewMortgageCash;
          const r = calculateSettlement({
            ...base,
            newMortgageCash: Math.floor(random() * max),
          });

          expect(
            r.existingAfterTax + r.newAfterTax + r.noteAfterTax,
          ).toBeCloseTo(r.totalAfterTax, 2);
          expect(r.existingAfterTax).toBeLessThanOrEqual(r.existingMonthly);
          expect(r.newAfterTax).toBeLessThanOrEqual(r.newMonthly);
          expect(r.noteAfterTax).toBeLessThanOrEqual(r.noteMonthly);
          expect(r.totalAfterTax).toBeLessThanOrEqual(r.totalMonthly);
        }
      }
    }
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
        // Udbetalingen skal være mindst så stor, at realkredit kan dække
        // resten, og kan aldrig overstige egenfinansieringen.
        const minDown = Math.ceil(
          Math.max(
            0,
            values.ownFinancing -
              MORTGAGE_LTV_MAX * Math.max(values.marketValue, PURCHASE_PRICE),
          ),
        );
        const downPayment =
          minDown + Math.floor(random() * (values.ownFinancing - minDown + 1));

        const base = settlementInput(values, {
          loanType,
          loan: { downPayment },
          newMortgageCash: 0,
        });
        const max = calculateSettlement(base).maxNewMortgageCash;
        const input = {
          ...base,
          newMortgageCash: Math.floor(random() * max),
        };
        const r = calculateSettlement(input);

        // Det genererede lån skal selv være gyldigt.
        expect(downPayment).toBeLessThanOrEqual(values.ownFinancing);
        expect(base.loanResult.mortgageCash).toBeLessThanOrEqual(
          base.loanResult.maxMortgageCash,
        );

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
