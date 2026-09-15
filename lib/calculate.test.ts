import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { MAX_FORGIVEN, PURCHASE_PRICE } from './constants';

describe('constants', () => {
  it('udleder købesummen efter 20%-reglen', () => {
    expect(PURCHASE_PRICE).toBe(6_700_400);
    expect(MAX_FORGIVEN).toBe(403_000);
  });
});

describe('calculate', () => {
  it('dækker forskuddet når den øvrige formue er stor', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 20_000_000,
      ownFinancing: 4_000_000,
    });

    expect(r.advance).toBe(5_702_600);
    expect(r.estateMass).toBe(28_000_000);
    expect(r.share).toBe(7_000_000);
    expect(r.advanceCovered).toBe(true);
    expect(r.withoutAgreement.daughterPays).toBe(1_000_000);
    expect(r.withoutAgreement.siblingEach).toBe(7_000_000);
    expect(r.withAgreement).toEqual(r.withoutAgreement);
  });

  it('rammer grænsen hvor forskuddet præcis svarer til arvelodden', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 14_810_400,
      ownFinancing: 4_000_000,
    });

    expect(r.share).toBe(5_702_600);
    expect(r.advance).toBe(r.share);
    expect(r.advanceCovered).toBe(true);
    expect(r.withoutAgreement.daughterPays).toBe(2_297_400);
    expect(r.equalityAssets).toBe(14_810_400);
  });

  it('beregner overskydende forskud i begge scenarier', () => {
    const r = calculate({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(r.share).toBe(2_500_000);
    expect(r.advanceCovered).toBe(false);
    expect(r.excess).toBe(3_202_600);

    expect(r.withoutAgreement.daughterPays).toBe(2_297_400);
    expect(r.withoutAgreement.siblingEach).toBeCloseTo(1_432_466.67, 2);
    expect(r.withoutAgreement.daughterTotal).toBe(5_702_600);
    expect(r.withoutAgreement.daughterPaidOut).toBe(0);

    expect(r.withAgreement.daughterPays).toBe(5_500_000);
    expect(r.withAgreement.siblingEach).toBe(2_500_000);
    expect(r.withAgreement.daughterTotal).toBe(2_500_000);
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
        ).toBeCloseTo(3 * scenario.siblingEach, 6);
      }
    }
  });
});
