import { describe, expect, it } from 'vitest';
import { calculate, type CalculationInput } from './calculate';
import { PURCHASE_PRICE } from './constants';
import { explain } from './explanations';

function texts(input: CalculationInput) {
  return explain(input, calculate(input));
}

describe('explain', () => {
  it('udleder købesummens forklaring af konstanterne', () => {
    const t = texts({
      marketValue: 10_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.purchasePrice).toBe(
      "Anpart A's andel af 2020-vurderingen er 50% × 16.751.000 = 8.375.500 kr. " +
        'Datteren køber til 80% heraf, som er den laveste pris efter 20%-reglen.',
    );
  });

  it('skriver regnestykket bag beregningsmassen og statuslinjen', () => {
    const t = texts({
      marketValue: 10_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.estateMass).toContain('2.000.000 + 10.000.000 − 4.000.000 = 8.000.000 kr.');
    expect(t.estateMass).toContain('2.000.000 kr. pr. barn');

    expect(t.status).toContain('overstiger hendes arvelod med 1.702.600 kr.');
    expect(t.status).toContain('4.297.400 ÷ 3 = 1.432.467 kr.');
  });

  it('holder identiteten øvrig formue + værdi − egenfinansiering', () => {
    let seed = 8_375_500;
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

      expect(calculate(input).estateMass).toBe(
        input.otherAssets +
          Math.max(input.marketValue, PURCHASE_PRICE) -
          input.ownFinancing,
      );
    }
  });

  it('forklarer at der ingen fordel er under købesummen', () => {
    const t = texts({
      marketValue: 5_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.benefit).toBe(
      'Markedsværdien er ikke højere end købesummen, så datteren får ingen fordel gennem prisen.',
    );
    // Identiteten bruger købesummen, når markedsværdien er lavere.
    expect(t.estateMass).toContain('øvrig formue + købesum − egenfinansiering');
    expect(t.estateMass).toContain('2.000.000 + 6.700.400 − 4.000.000 = 4.700.400 kr.');
  });

  it('forklarer at der intet gældsbrev er ved fuld egenfinansiering', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: PURCHASE_PRICE,
    });

    expect(t.promissoryNote).toBe(
      'Datteren finansierer hele købesummen selv, så der er intet gældsbrev.',
    );
    expect(t.forgiven).toBe('Der er ingen gæld at eftergive.');
  });

  it('forklarer at eftergivelsen begrænses af et lille gældsbrev', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 6_500_000,
    });

    expect(t.forgiven).toBe(
      'Faren eftergiver 80.600 kr. om året, som er det afgiftsfri beløb, men ' +
        'gældsbrevet er kun på 200.400 kr., så eftergivelsen begrænses hertil. ' +
        'Beløbet er en gave og indgår derfor som forskud.',
    );
  });

  it('forklarer eftergivelsen over fem år, når gældsbrevet er stort nok', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 2_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.forgiven).toBe(
      'Faren eftergiver 80.600 kr. om året, som er det afgiftsfri beløb. ' +
        'Beregningen antager fem års eftergivelser. ' +
        'Beløbet er en gave og indgår derfor som forskud.',
    );
  });

  it('forklarer et dækket forskud, hvor datteren indbetaler', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 20_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.status).toBe(
      'Datterens forskud på 5.702.600 kr. er mindre end hendes arvelod på ' +
        '7.000.000 kr. Hun arver differencen på 1.297.400 kr., som modregnes ' +
        'i restgælden på 2.297.400 kr. Hun indbetaler derfor 1.000.000 kr. ' +
        'til boet. Hver søskende får 7.000.000 kr. Det gælder med og uden ' +
        'udligningsaftale.',
    );
  });

  it('forklarer et dækket forskud, hvor datteren får udbetalt', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 30_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.status).toContain('Hun får derfor 1.500.000 kr. udbetalt.');
    expect(t.status).toContain('Hver søskende får 9.500.000 kr.');
  });

  it('forklarer et dækket forskud, hvor beløbene går lige op', () => {
    const t = texts({
      marketValue: 12_000_000,
      otherAssets: 24_000_000,
      ownFinancing: 4_000_000,
    });

    expect(t.status).toContain('Beløbene går lige op.');
  });
});
