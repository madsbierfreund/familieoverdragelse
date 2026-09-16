import { describe, expect, it } from 'vitest';
import { GIFT_YEARS } from './constants';
import { toTodaysValue } from './inflation';
import { calculateSettlement } from './settlement';
import { DEFAULT_INFLATION_RATE } from './settlementConstants';
import { settlementInput } from './testFixtures';

describe('toTodaysValue', () => {
  it('tilbagediskonterer et beløb med inflationen', () => {
    expect(toTodaysValue(22_493, 0.03, 10)).toBeCloseTo(16_737, 0);
    expect(toTodaysValue(51_941.97, 0.03, 5)).toBeCloseTo(44_806, 0);
  });

  it('lader beløbet stå uden inflation eller uden år', () => {
    expect(toTodaysValue(22_493, 0, 10)).toBe(22_493);
    expect(toTodaysValue(22_493, 0.03, 0)).toBe(22_493);
  });

  it('omregner udligningens ydelse til dagens kroner', () => {
    const r = calculateSettlement(
      settlementInput({
        marketValue: 12_000_000,
        otherAssets: 2_000_000,
        ownFinancing: 4_000_000,
      }),
    );

    expect(r.totalMonthly).toBeCloseTo(51_941.97, 2);
    expect(
      toTodaysValue(r.totalMonthly, DEFAULT_INFLATION_RATE, GIFT_YEARS),
    ).toBeCloseTo(44_806, 0);
  });

  it('gør et beløb mindre, jo længere der er til det', () => {
    const near = toTodaysValue(100_000, 0.03, 1);
    const far = toTodaysValue(100_000, 0.03, 10);

    expect(far).toBeLessThan(near);
    expect(near).toBeLessThan(100_000);
  });
});
