import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import {
  GIFT_YEARS,
  MAX_FORGIVEN,
  PURCHASE_PRICE,
  SIBLINGS,
} from './constants';

describe('constants', () => {
  it('udleder købesummen efter 20%-reglen', () => {
    expect(PURCHASE_PRICE).toBe(6_700_400);
    expect(MAX_FORGIVEN).toBe(403_000);
  });
});

describe('calculate med et andet dødsår', () => {
  const values = {
    marketValue: 12_000_000,
    otherAssets: 2_000_000,
    ownFinancing: 4_000_000,
  };

  it('eftergiver et år mere for hvert år til dødsfaldet', () => {
    expect(calculate(values, 5).forgiven).toBe(403_000);
    expect(calculate(values, 10).forgiven).toBe(806_000);
    expect(calculate(values, 10).remainingDebt).toBe(1_894_400);
    expect(calculate(values, 20).forgiven).toBe(1_612_000);
    expect(calculate(values, 30).forgiven).toBe(2_418_000);
  });

  it('eftergiver aldrig mere end gældsbrevet', () => {
    const r = calculate({ ...values, ownFinancing: 6_500_000 }, 30);

    expect(r.promissoryNote).toBe(200_400);
    expect(r.forgiven).toBe(200_400);
    expect(r.remainingDebt).toBe(0);
  });

  it('bruger fem år, når intet andet er valgt', () => {
    expect(calculate(values)).toEqual(calculate(values, GIFT_YEARS));
  });
});

describe('calculate', () => {
  it('dækker forskuddet når den øvrige formue er stor', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 25_000_000,
      ownFinancing: 4_000_000,
    });

    expect(r.advance).toBe(5_702_600);
    expect(r.estateMass).toBe(33_000_000);
    expect(r.share).toBe(6_600_000);
    expect(r.advanceCovered).toBe(true);
    expect(r.withoutAgreement.daughterPays).toBe(1_400_000);
    expect(r.withoutAgreement.siblingEach).toBe(6_600_000);
    expect(r.withAgreement).toEqual(r.withoutAgreement);
  });

  it('rammer grænsen hvor forskuddet præcis svarer til arvelodden', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 20_513_000,
      ownFinancing: 4_000_000,
    });

    expect(r.share).toBe(5_702_600);
    expect(r.advance).toBe(r.share);
    expect(r.advanceCovered).toBe(true);
    expect(r.withoutAgreement.daughterPays).toBe(2_297_400);
    expect(r.equalityAssets).toBe(20_513_000);
  });

  it('beregner overskydende forskud i begge scenarier', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(r.estateMass).toBe(10_000_000);
    expect(r.share).toBe(2_000_000);
    expect(r.advanceCovered).toBe(false);
    expect(r.excess).toBe(3_702_600);

    expect(r.withoutAgreement.daughterPays).toBe(2_297_400);
    expect(r.withoutAgreement.siblingEach).toBe(1_074_350);
    expect(r.withoutAgreement.daughterTotal).toBe(5_702_600);
    expect(r.withoutAgreement.daughterPaidOut).toBe(0);

    expect(r.withAgreement.daughterPays).toBe(6_000_000);
    expect(r.withAgreement.siblingEach).toBe(2_000_000);
    expect(r.withAgreement.daughterTotal).toBe(2_000_000);
    expect(r.withAgreement.daughterPaidOut).toBe(0);
  });

  it('eftergiver hele gældsbrevet når det er mindre end de fem gaver', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 6_500_000,
    });

    expect(r.promissoryNote).toBe(200_400);
    expect(r.forgiven).toBe(200_400);
    expect(r.remainingDebt).toBe(0);
  });

  it('giver ingen fordel når markedsværdien er under købesummen', () => {
    const r = calculate({
      marketValue: 5_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(r.benefit).toBe(0);
    expect(r.advance).toBe(r.forgiven);
  });

  it('holder invarianten for tilfældige gyldige input', () => {
    let seed = 20_200_401;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    for (let i = 0; i < 200; i++) {
      const input = {
        marketValue: Math.round(random() * 20_000_000),
        otherAssets: Math.round(random() * 30_000_000),
        ownFinancing: Math.round(random() * PURCHASE_PRICE),
      };
      const r = calculate(input);

      for (const scenario of [r.withoutAgreement, r.withAgreement]) {
        expect(
          input.otherAssets + scenario.daughterPays - scenario.daughterPaidOut,
        ).toBeCloseTo(SIBLINGS * scenario.siblingEach, 6);
      }
    }
  });
});
